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

#include "election_manager.h"
#include "ledger/ledger_manager.h"

namespace bumo {
	ElectionManager::ElectionManager(): candidate_mpt_(nullptr){

	}

	ElectionManager::~ElectionManager(){
		if (candidate_mpt_){
			delete candidate_mpt_;
			candidate_mpt_ = nullptr;
		}
	}

	bool ElectionManager::Initialize(){
		candidate_mpt_ = new KVTrie();
		auto batch = std::make_shared<WRITE_BATCH>();
		candidate_mpt_->Init(Storage::Instance().account_db(), batch, General::VALIDATOR_CANDIDATE_PREFIX, 1);

		ValidatorCandidatesLoad();

		// Election configuration
		ElectionConfigure& ecfg = Configure::Instance().election_configure_;

		// Initialize election configuration to db if get configuration failed
		if (!ElectionConfigGet(election_config_)) {
			LOG_ERROR("Failed to get election configuration!");
			election_config_.set_pledge_amount(ecfg.pledge_amount_);
			election_config_.set_validators_refresh_interval(ecfg.validators_refresh_interval_);
			election_config_.set_coin_to_vote_rate(ecfg.coin_to_vote_rate_);
			election_config_.set_fee_to_vote_rate(ecfg.fee_to_vote_rate_);
			election_config_.set_fee_distribution_rate(ecfg.fee_distribution_rate_);
			election_config_.set_penalty_rate(ecfg.penalty_rate_);

			ElectionConfigSet(batch, election_config_);
			KeyValueDb *db = Storage::Instance().account_db();
			if (!db->WriteBatch(*batch)){
				LOG_ERROR("Failed to write election configuration to database(%s)", db->error_desc().c_str());
				return false;
			}
		}
		LOG_INFO("The election configuration is : %s", election_config_.DebugString().c_str());

		// Validator abnormal records
		std::string key = "abnormal_records";
		auto db = Storage::Instance().account_db();
		std::string json_str;
		if (db->Get(key, json_str)) {
			abnormal_records_.clear();
			Json::Value abnormal_json;
			if (abnormal_json.fromString(json_str)) {
				LOG_ERROR("Failed to parse the json content of validator abnormal records");
				UpdateAbnormalRecords();
			}
			else {
				for (size_t i = 0; i < abnormal_json.size(); i++) {
					Json::Value& item = abnormal_json[i];
					abnormal_records_.insert(std::make_pair(item["address"].asString(), item["count"].asInt64()));
				}
			}
		}
		else {
			// write test value
			abnormal_records_.insert(std::make_pair("buQcjgnBuoLkKdoggtJsQxiEPAFifgQBKu16", 10));
			abnormal_records_.insert(std::make_pair("buQWQ4rwVW8RCzatR8XnRnhMCaCeMkE46qLR", 1));
		}

		TimerNotify::RegisterModule(this);
		StatusModule::RegisterModule(this);
		return true;
	}

	bool ElectionManager::Exit() {
		LOG_INFO("Election manager stoping...");

		if (candidate_mpt_) {
			delete candidate_mpt_;
			candidate_mpt_ = nullptr;
		}
		LOG_INFO("election manager stoped. [OK]");
		return true;
	}

	void ElectionManager::OnTimer(int64_t current_time){
	}

	void ElectionManager::OnSlowTimer(int64_t current_time){
	}

	void ElectionManager::GetModuleStatus(Json::Value &data){
	}

	void ElectionManager::ElectionConfigSet(std::shared_ptr<WRITE_BATCH> batch, const protocol::ElectionConfig &ecfg) {
		batch->Put("election_config", ecfg.SerializeAsString());
	}

	bool ElectionManager::ElectionConfigGet(protocol::ElectionConfig &ecfg) {
		std::string key = "election_config";
		auto db = Storage::Instance().account_db();
		std::string str;
		if (!db->Get(key, str)) {
			return false;
		}
		return ecfg.ParseFromString(str);
	}

	void ElectionManager::AddAbnormalRecord(const std::string& abnormal_node) {
		std::unordered_map<std::string, int64_t>::iterator it = abnormal_records_.find(abnormal_node);
		if (it != abnormal_records_.end()) {
			it->second++;
		}
		else {
			abnormal_records_.insert(std::make_pair(abnormal_node, 1));
		}
		UpdateAbnormalRecords();
	}

	void ElectionManager::GetAbnormalRecords(Json::Value& records) {
		for (std::unordered_map<std::string, int64_t>::iterator it = abnormal_records_.begin();
			it != abnormal_records_.end();
			it++) {
			records[it->first] = it->second;
		}
	}

	void ElectionManager::UpdateAbnormalRecords() {
		std::string key = "abnormal_records";

		Json::Value abnormal_json;
		for (std::unordered_map<std::string, int64_t>::iterator it = abnormal_records_.begin();
			it != abnormal_records_.end();
			it++) {
			Json::Value item;
			item["address"] = it->first;
			item["count"] = it->second;
			abnormal_json.append(item);
		}
		auto batch = candidate_mpt_->batch_;
		batch->Put("abnormal_records", abnormal_json.toFastString());
		KeyValueDb *db = Storage::Instance().account_db();
		if (!db->WriteBatch(*batch)){
			LOG_ERROR("Failed to write abnormal records to database(%s)", db->error_desc().c_str());
		}
		else {
			LOG_TRACE("Update abnormal records to db done");
		}
	}

	int64_t ElectionManager::CoinToVotes(int64_t coin) {
		if (election_config_.coin_to_vote_rate() < 1) {
			return 0;
		}
		else {
			return coin / election_config_.coin_to_vote_rate();
		}
	}

	int64_t ElectionManager::FeeToVotes(int64_t fee) {
		if (election_config_.fee_to_vote_rate() < 1) {
			return 0;
		}
		else {
			return fee / election_config_.coin_to_vote_rate();
		}
	}

	int64_t ElectionManager::GetValidatorsRefreshInterval() {
		return election_config_.validators_refresh_interval();
	}

	bool ElectionManager::GetFeesShareByOwner(FeesOwner owner, uint32_t& rate) {
		std::vector<std::string> vec = utils::String::split(election_config_.fee_distribution_rate(), ":");
		if (vec.size() != 4) {
			LOG_ERROR("Failed to get fees share, owner type:" FMT_I64"", owner);
			return false;
		}
		uint32_t count = 0;
		uint32_t owner_value = 0;
		for (int i = 0; i < 4; i++) {
			uint32_t value = 0;
			if (vec[i].empty() || vec[i] == "0") {
				value = 0;
			} 
			else {
				if (!utils::String::SafeStoui(vec[i], value)) {
					LOG_ERROR("Failed to convert string(%s) to int", vec[i].c_str());
					return false;
				}
			}
			if (!utils::SafeIntAdd(count, value, count)){
				LOG_ERROR("Overflowed when get fees share.");
				return false;
			}
			if (i == owner) owner_value = value;
		}
		rate = owner_value * 100 / count; // multiply by 100 to avoid float number convert

		return true;
	}

	CandidatePtr ElectionManager::GetValidatorCandidate(const std::string& key){
		CandidatePtr candidate = nullptr;

		auto it = validator_candidates_.find(key);
		if (it != validator_candidates_.end()){
			candidate = it->second;
		}

		return candidate;
	}

	bool  ElectionManager::SetValidatorCandidate(const std::string& key, CandidatePtr value){
		if (!value){
			return false;
		}

		try{
			validator_candidates_[key] = value;
		}
		catch (std::exception& e){
			return false;
		}

		return true;
	}

	bool ElectionManager::SetValidatorCandidate(const std::string& key, const protocol::ValidatorCandidate& value){
		try{
			CandidatePtr candidate = std::make_shared<protocol::ValidatorCandidate>(value);
			validator_candidates_[key] = candidate;
		}
		catch (std::exception& e){
			return false;
		}

		return true;
	}

	void ElectionManager::DelValidatorCandidate(const std::string& key){
		validator_candidates_.erase(key);
		to_delete_candidates_.push_back(key);
	}

	bool ElectionManager::ValidatorCandidatesStorage() {
		try{
			for (auto kv : validator_candidates_){
				candidate_mpt_->Set(kv.first, kv.second->SerializeAsString());
			}

			for (auto node : to_delete_candidates_){
				candidate_mpt_->Delete(node);
			}

			to_delete_candidates_.clear();
			candidate_mpt_->UpdateHash();
		}
		catch (std::exception& e){
			return false;
		}

		return true;
	}

	bool ElectionManager::ValidatorCandidatesLoad() {

		try{
			std::vector<std::string> entries;
			candidate_mpt_->GetAll("", entries);
			if (!entries.empty()){
				for (size_t i = 0; i < entries.size(); i++){
					CandidatePtr candidate = std::make_shared<protocol::ValidatorCandidate>();
					candidate->ParseFromString(entries[i]);
					validator_candidates_[candidate->address()] = candidate;
				}
			}
			else{
				auto set = LedgerManager::Instance().Validators();
				for (size_t i = 0; i < set.validators_size(); i++){
					CandidatePtr candidate = std::make_shared<protocol::ValidatorCandidate>();
					candidate->set_address(set.mutable_validators(i)->address());
					candidate->set_pledge(set.mutable_validators(i)->pledge_coin_amount());
					validator_candidates_[candidate->address()] = candidate;
				}
			}
		}
		catch (std::exception& e){
			return false;
		}

		return true;
	}

	void ElectionManager::UpdateToDB(){
		if (!Storage::Instance().account_db()->WriteBatch(*(candidate_mpt_->batch_))) {
			PROCESS_EXIT("Failed to write accounts to database: %s", Storage::Instance().account_db()->error_desc().c_str());
		}
	}

	bool ElectionManager::CheckAbnormalRecord(int64_t& total_penalty) {
		std::unordered_map<std::string, int64_t>::iterator ait = abnormal_records_.begin();
		
		for (; ait != abnormal_records_.end(); ait++) {
			if (ait->second > 10) {
				// penalty_amount = pledge * penalty_rate * (num_abnormal - 10) / 100
				int64_t penalty_100 = 0;
				if (!utils::SafeIntMul(ait->second - 10, election_config_.penalty_rate(), penalty_100)) {
					LOG_ERROR("Calculation overflowed when abnormal records:(" FMT_I64 ") * penalty rate(" FMT_I64 ") of return.", ait->second, election_config_.penalty_rate());
					return false;
				}

				CandidatePtr candidate = GetValidatorCandidate(ait->first);
				if (!candidate) {
					LOG_ERROR("Failed to get candidate info of %s", ait->first.c_str());
					return false;
				}

				int64_t penalty_amount = 0;
				if (penalty_100 > 100) {
					penalty_amount = candidate->pledge();
				}
				else {
					if (!utils::SafeIntMul(candidate->pledge(), penalty_100, penalty_amount)) {
						LOG_ERROR("Calculation overflowed when old pledge:(" FMT_I64 ") * penalty_100 (" FMT_I64 ") of return.", candidate->pledge(), penalty_100);
						return false;
					}
					penalty_amount /= 100;
				}
				
				if (!utils::SafeIntAdd(total_penalty, candidate->pledge(), total_penalty)) {
					LOG_ERROR("Calculation overflowed when total penalty:(" FMT_I64 ") + pledge(" FMT_I64 ") of return.", total_penalty, candidate->pledge());
					return false;
				}
				int64_t new_pledge = 0;
				if (!utils::SafeIntSub(candidate->pledge(), penalty_amount, new_pledge)) {
					LOG_ERROR("Calculation overflowed when old pledge:(" FMT_I64 ") * penalty_100 (" FMT_I64 ") of return.", candidate->pledge(), penalty_100);
					return false;
				}
				candidate->set_pledge(new_pledge);

				ait->second = 0; // clear abnormal records
			} else if (ait->second > 0){
				LOG_ERROR("Candidate %s has " FMT_I64 " times abnormal records", ait->first.c_str(), ait->second);
			}
		}
		return true;
	}

	bool ElectionManager::DynastyChange(Json::Value& validators_json) {
		// check abnormal records and make punishment
		int64_t total_penalty = 0;
		if (CheckAbnormalRecord(total_penalty)) {
			LOG_ERROR("Failed to check and handle abnormal records");
			return false;
		}

		// sort candidate and update validators
		std::multimap<int64_t, CandidatePtr> new_validators;
		std::unordered_map<std::string, CandidatePtr>::iterator it = validator_candidates_.begin();
		for (; it != validator_candidates_.end(); it++) {
			int64_t key = it->second->coin_vote() + it->second->fee_vote();
			if (new_validators.size() < General::MAX_VALIDATORS) {
				new_validators.insert(std::make_pair(key, it->second));
			}
			else {
				if (new_validators.begin()->first < key) {
					new_validators.insert(std::make_pair(key, it->second));
					new_validators.erase(new_validators.begin());
				}
			}
		}

		std::multimap<int64_t, CandidatePtr>::iterator vit = new_validators.begin();
		for (; vit != new_validators.end(); vit++) 
		{
			Json::Value value;
			value.append(vit->second->address());
			value.append(utils::String::ToString(vit->second->pledge()));
			validators_json.append(value);
		}

		int64_t reward = total_penalty / validator_candidates_.size();
		int64_t reward_left = total_penalty % validator_candidates_.size();
		// add pledge coin and clear fee_votes
		for (; it != validator_candidates_.end(); it++) {
			int64_t new_pledge = 0;
			if (!utils::SafeIntAdd(it->second->pledge(), reward, new_pledge)) {
				LOG_ERROR("Calculation overflowed when old pledge:(" FMT_I64 ") + reward(" FMT_I64 ") of return.", it->second->pledge(), reward);
				return false;
			}
			it->second->set_pledge(new_pledge);
			it->second->clear_fee_vote();
		}
	}
}
