
#include "block_listen_manager.h"
#include <common/general.h>
#include "cross/message_channel_manager.h"
#include "cross/main_proposer_manager.h"
#include <cross/child_proposer_manager.h>
#include <proto/cpp/overlay.pb.h>
#include <common/private_key.h>

namespace bumo {

	const static char* OP_CREATE_CHILD_CHAIN = "createChildChain";
	const static char* OP_DEPOSIT = "deposit";
	const static char* OP_WITHDRAWAL = "withdrawal";
	const static char* OP_WITHDRAWALINIT = "withdrawalInit";
	const static char* OP_CHALLENGE = "challenge";
	const static char* OP_CHANGE_VALIDATOR = "changeValidator";

	BlockListenBase::BlockListenBase() :
		enabled_(false),
		thread_ptr_(NULL){
		last_update_time_ = utils::Timestamp::HighResolution();
		last_buffer_time_ = utils::Timestamp::HighResolution();
	}

	BlockListenBase::~BlockListenBase(){
		if (thread_ptr_){
			delete thread_ptr_;
			thread_ptr_ = NULL;
		}
	}

	void BlockListenBase::TxFrmToTlog(const LedgerFrm::pointer &closing_ledger, const TransactionFrm::pointer &txFrm){
		for (int i = 0; i < txFrm->instructions_.size(); i++){
			const protocol::Transaction &trans = txFrm->instructions_[i].transaction_env().transaction();
			for (int j = 0; j < trans.operations_size(); j++){
				if (protocol::Operation_Type_LOG != trans.operations(j).type()){
					continue;
				}
				const protocol::OperationLog &log = trans.operations(j).log();
				if (log.topic().size() == 0 || log.topic().size() > General::TRANSACTION_LOG_TOPIC_MAXSIZE){
					LOG_ERROR("Log's parameter topic size should be between (0,%d]", General::TRANSACTION_LOG_TOPIC_MAXSIZE);
					continue;
				}
				//special transaction
				if (ParseTlog(log.topic()) == protocol::MESSAGE_CHANNEL_TYPE::MESSAGE_CHANNEL_TYPE_NONE){
					continue;
				}
				//transfer tlog params must be 2
				if (log.datas_size() != 2){
					LOG_ERROR("tlog parames number should have 2,but now is ", log.datas_size());
					break;
				}
				HandleTlogEvent(closing_ledger, log);
				LOG_INFO("get tlog topic:%s,args[0]:%s,args[1]:%s", log.topic().c_str(), log.datas(0).c_str(), log.datas(1).c_str());
			}
		}
	}

	bool BlockListenBase::Initialize() {
		enabled_ = true;
		thread_ptr_ = new utils::Thread(this);
		if (!thread_ptr_->Start("BlockListenManager")) {
			return false;
		}
		return true;
	}

	bool BlockListenBase::Exit(){
		enabled_ = false;
		if (thread_ptr_) {
			thread_ptr_->JoinWithStop();
		}
		return true;
	}

	void BlockListenBase::Run(utils::Thread *thread) {
		while (enabled_){
			utils::Sleep(10);
			int64_t current_time = utils::Timestamp::HighResolution();
			if ((current_time - last_buffer_time_) > BUFFER_PERIOD * utils::MICRO_UNITS_PER_SEC){
				CopyBufferBlock();
				last_buffer_time_ = current_time;
			}

			if ((current_time - last_update_time_) > UPDATE_PERIOD * utils::MICRO_UNITS_PER_SEC){
				HandleBlockUpdate();
				last_update_time_ = current_time;
			}
		}
	}

	protocol::MESSAGE_CHANNEL_TYPE BlockListenBase::ParseTlog(std::string tlog_topic){
		if (tlog_topic.empty()){
			return protocol::MESSAGE_CHANNEL_TYPE::MESSAGE_CHANNEL_TYPE_NONE;
		}

		if (0 == strcmp(tlog_topic.c_str(), OP_CREATE_CHILD_CHAIN)){
			return protocol::MESSAGE_CHANNEL_TYPE::MESSAGE_CHANNEL_CREATE_CHILD_CHAIN;
		}
		else if (0 == strcmp(tlog_topic.c_str(), OP_DEPOSIT)){
			return protocol::MESSAGE_CHANNEL_TYPE::MESSAGE_CHANNEL_DEPOSIT;
		}
		else if (0 == strcmp(tlog_topic.c_str(), OP_WITHDRAWAL)){
			return protocol::MESSAGE_CHANNEL_TYPE::MESSAGE_CHANNEL_WITHDRAWAL;
		}
		else if (0 == strcmp(tlog_topic.c_str(), OP_CHALLENGE)){
			return protocol::MESSAGE_CHANNEL_TYPE::MESSAGE_CHANNEL_CHALLENGE_WITHDRAWAL;
		}
		else if (0 == strcmp(tlog_topic.c_str(), OP_CHANGE_VALIDATOR)){
			return protocol::MESSAGE_CHANNEL_TYPE::MESSAGE_CHANNEL_CHANGE_CHILD_VALIDATOR;
		}
		else{
			return protocol::MESSAGE_CHANNEL_TYPE::MESSAGE_CHANNEL_TYPE_NONE;
		}
	}


	void BlockListenBase::MessageChannelToMsg(protocol::MESSAGE_CHANNEL_TYPE msg_type, std::shared_ptr<Message> &msg){
		switch (msg_type){
		case protocol::MESSAGE_CHANNEL_TYPE::MESSAGE_CHANNEL_CREATE_CHILD_CHAIN:
			msg = std::make_shared<protocol::MessageChannelCreateChildChain>();
			break;
		case protocol::MESSAGE_CHANNEL_TYPE::MESSAGE_CHANNEL_DEPOSIT:
			msg = std::make_shared<protocol::MessageChannelDeposit>();
			break;
		case protocol::MESSAGE_CHANNEL_TYPE::MESSAGE_CHANNEL_CHANGE_CHILD_VALIDATOR:
			msg = std::make_shared<protocol::MessageChannelChangeChildValidator>();
			break;
		case protocol::MESSAGE_CHANNEL_TYPE::MESSAGE_CHANNEL_WITHDRAWAL:
			msg = std::make_shared<protocol::MessageChannelWithdrawal>();
			break;
		case protocol::MESSAGE_CHANNEL_TYPE::MESSAGE_CHANNEL_CHALLENGE_WITHDRAWAL:
			msg = std::make_shared<protocol::MessageChannelWithdrawalChallenge>();
			break;
		default:
			msg = nullptr;
			break;
		}
	}

