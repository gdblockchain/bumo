/*
	bumo is free software: you can redistribute it and/or modify
	it under the terms of the GNU General Public License as published by
	the Free Software Foundation, either version 3 of the License, or
	(at your option) any later version.

	bumo is distributed in the hope that it will be useful,
	but WITHOUT ANY WARRANTY; without even the implied warranty of
	MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
	GNU General Public License for more details.

	You should have received a copy of the GNU General Public License
	along with bumo.  If not, see <http://www.gnu.org/licenses/>.
	*/

#ifndef CROSS_UTILS_H_
#define CROSS_UTILS_H_
#include<ledger/ledger_manager.h>
#include<proto/cpp/overlay.pb.h>
using namespace std;
class MerkleNode;
namespace bumo {
	class CrossUtils : public utils::NonCopyable{
	public:
		CrossUtils() {}
		~CrossUtils() {}
		static int32_t QueryContract(const std::string &address, const std::string &input, Json::Value &query_rets);
	};

	struct TransTask{
		std::vector<std::string> input_paras_;
		int32_t amount_;
		std::string dest_address_;
		std::string user_defined_;

		TransTask(){
			input_paras_.clear();
			amount_ = 0;
			dest_address_.clear();
			user_defined_.clear();
		}

		TransTask(const std::vector<std::string> &input_paras, int32_t amount, const std::string &dest_address, const std::string &user_defined){
			input_paras_ = input_paras;
			amount_ = amount;
			dest_address_ = dest_address;
			user_defined_ = user_defined;
		}

	};
	typedef std::vector<TransTask> TransTaskVector;

	struct TransTaskResult{
		bool result_;
		std::string desc_;
		std::string hash_;

		TransTaskResult(){
			result_ = false;
			desc_.clear();
			hash_.clear();
		}
		TransTaskResult(bool result, const std::string &desc, const std::string &hash){
			result_ = result;
			desc_ = desc;
			hash_ = hash;
		}
	};

	class ITransactionSenderNotify{
	public:
		virtual void HandleTransactionSenderResult(const TransTask &task_task, const TransTaskResult &task_result) = 0;
	};

	class TransactionSender : public utils::Singleton<TransactionSender>,
		public utils::Runnable{
		friend class utils::Singleton<TransactionSender>;

	public:
		TransactionSender();
		~TransactionSender();

		bool Initialize(const std::string &private_key);
		bool Exit();

		void AsyncSendTransaction(ITransactionSenderNotify *notify, const TransTask &tans_task);

	private:
		virtual void Run(utils::Thread *thread) override;
		void SendingAll();
		TransTaskResult SendingSingle(const std::vector<std::string> &paras, const std::string &dest);

		TransactionFrm::pointer BuildTransaction(const std::string &private_key, const std::string &dest, const std::vector<std::string> &paras, int64_t nonce);
		int32_t SendTransaction(TransactionFrm::pointer tran_ptr);

		bool enabled_;
		utils::Thread *thread_ptr_;

		int64_t cur_nonce_;
		int64_t last_update_time_;
		std::string source_address_;
		std::string private_key_;

		utils::Mutex task_vector_lock_;
		typedef std::map<ITransactionSenderNotify*, TransTaskVector> TransTaskMap;
		TransTaskMap trans_task_map_;
	};


	class MerkleNode {
		typedef std::shared_ptr<MerkleNode> MerkleNodePointer;
	public:
		MerkleNode();
		MerkleNodePointer GetParent();
		void  SetChildren(const MerkleNodePointer &children_l, const MerkleNodePointer &children_r);
		MerkleNodePointer GetChildrenLeft();
		MerkleNodePointer GetChildrenRight();
		void SetParent(const MerkleNodePointer &parent);
		string GetHash();
		MerkleNodePointer GetSibling();
		void SetHash(const std::string &leaf_hash);
		virtual ~MerkleNode();
		bool IsLeaf();
		int64_t CheckDir();
	private:
		std::string hash_;
		MerkleNodePointer left_node_;
		MerkleNodePointer right_node_;
		MerkleNodePointer parent_;
	};

	class MerkleTree{
		typedef std::shared_ptr<MerkleNode> MerkleNodePointer;
	public:
		MerkleTree();
		virtual ~MerkleTree();
		void BuildTree();
		string GetMerkleRoot();
		void BuildBaseLeafes(const vector<string> &base_leafs);
		void IterateUp(const int64_t &element);
		bool VerifyMerkelLeaf(const std::string &leaf_hash);

		void BuildAuditTrail(vector<protocol::MerkelProofHash> &audit_trail, const MerkleNodePointer &parent, const MerkleNodePointer &child);
		void AuditProof(const std::string &leaf_hash, std::vector<protocol::MerkelProofHash> &audit_trail);
		bool VerifyAudit(const std::string &root_hash, const std::string& leaf_hash, std::vector<protocol::MerkelProofHash> &audit_trail);
		string HashMerkleBranches(const std::string &left, const std::string &right);

	private:
		int64_t MakeBinary(std::vector<MerkleNodePointer> &node_vector);
		void PrintTreeLevel(const std::vector<MerkleNodePointer> &node_level);
		
	private:
		std::string merkle_root_;
		std::vector<vector<MerkleNodePointer>> base_nodes_; //It's a list of nodes
		utils::Mutex base_nodes_lock_;
	};
}

#endif