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

#include <common/storage.h>
#include "ledger_manager.h"
#include "environment.h"

namespace bumo{

	Environment::Environment(Map* data, SettingMap* settings, CandidateMap* candidates) :
		AtomMap<std::string, AccountFrm>(data), 
		settings_(settings), 
		candidates_(candidates)
	{
	}

	bool Environment::GetEntry(const std::string &key, AccountFrm::pointer &frm){
		return Get(key, frm);
	}

	bool Environment::Commit(){
		return settings_.Commit() && candidates_.Commit() && AtomMap<std::string, AccountFrm>::Commit();
	}

	void Environment::ClearChangeBuf()
	{
		settings_.ClearChangeBuf();
		candidates_.ClearChangeBuf();
		AtomMap<std::string, AccountFrm>::ClearChangeBuf();
	}

	bool Environment::AddEntry(const std::string& key, AccountFrm::pointer frm){
		return Set(key, frm);
	}

	bool Environment::GetFromDB(const std::string &address, AccountFrm::pointer &account_ptr)
	{
		return AccountFromDB(address, account_ptr);
	}

	bool Environment::AccountFromDB(const std::string &address, AccountFrm::pointer &account_ptr){
		std::string index = DecodeAddress(address);

		std::string buff;
		if (!LedgerManager::Instance().tree_->Get(index, buff)){
			return false;
		}

		protocol::Account account;
		if (!account.ParseFromString(buff)){
			PROCESS_EXIT("Failed to parse account(%s) from string, fatal error", address.c_str());
		}
		account_ptr = std::make_shared<AccountFrm>(account);
		return true;

	}

	std::shared_ptr<Environment> Environment::NewStackFrameEnv()
	{
		Map& data	= GetChangeBuf();
		SettingMap& settings = settings_.GetChangeBuf();
		CandidateMap& candidates = candidates_.GetChangeBuf();
		std::shared_ptr<Environment> next = std::make_shared<Environment>(&data, &settings, &candidates);

		return next;
	}

	bool Environment::UpdateFeeConfig(const Json::Value &feeConfig) {
		std::shared_ptr<Json::Value> fees;
		settings_.Get(feesKey, fees);

		if (!fees){
			fees = std::make_shared<Json::Value>(feeConfig);
			settings_.Set(feesKey, fees);
		}
		else{
			for (auto it = feeConfig.begin(); it != feeConfig.end(); it++) {
				(*fees)[it.memberName()] = feeConfig[it.memberName()];
			}
		}

		return true;
	}

	bool Environment::GetVotedFee(const protocol::FeeConfig& old_fee, protocol::FeeConfig& new_fee) {
		bool change = false;
		new_fee = old_fee;

		std::shared_ptr<Json::Value> fees;
		settings_.Get(feesKey, fees);
		if (!fees) return false;

		for (auto it = fees->begin(); it != fees->end(); it++) {
			int32_t fee_type = (protocol::FeeConfig_Type)utils::String::Stoi(it.memberName());
			int64_t price = (*fees)[it.memberName()].asInt64();

			switch ((protocol::FeeConfig_Type)fee_type) {
			case protocol::FeeConfig_Type_UNKNOWN:
				LOG_ERROR("FeeConfig type error");
				break;
			case protocol::FeeConfig_Type_GAS_PRICE:
				if (new_fee.gas_price() != price) {
					new_fee.set_gas_price(price);
					change = true;
				}
				break;
			case protocol::FeeConfig_Type_BASE_RESERVE:
				if (new_fee.base_reserve() != price) {
					new_fee.set_base_reserve(price);
					change = true;
				}
				break;
			default:
				LOG_ERROR("Fee config type(%d) error", fee_type);
				break;
			}

		}

		return change;
	}

	bool Environment::UpdateElectionConfig(const Json::Value& electionConfig) {
		std::shared_ptr<Json::Value> ecfg;
		settings_.Get(electionKey, ecfg);

		if (!ecfg){
			ecfg = std::make_shared<Json::Value>(electionConfig);
			settings_.Set(electionKey, ecfg);
		}
		else{
			for (auto it = electionConfig.begin(); it != electionConfig.end(); it++) {
				(*ecfg)[it.memberName()] = electionConfig[it.memberName()];
			}
		}

		return true;
	}

	bool Environment::GetVotedElectionConfig(const protocol::ElectionConfig& old_cfg, protocol::ElectionConfig& new_cfg) {
		bool change = false;
		new_cfg = old_cfg;

		Json::Value election_cfg;
		AccountFrm::pointer election_config_contract;
		if (!GetEntry(General::CONTRACT_ELECTION_CONFIG_ADDRESS, election_config_contract)) {
			return false;
		}
		protocol::KeyPair pair;
		if (!election_config_contract->GetMetaData(electionKey, pair)) {
			return false;
		}
		else {
			if (!election_cfg.fromString(pair.value())) {
				LOG_ERROR("Failed to parse election configuration from metadata data, %s", pair.value().c_str());
				return false;
			}
		}

		for (auto it = election_cfg.begin(); it != election_cfg.end(); it++) {
			std::string key = it.memberName();
			std::string value = election_cfg[key].asString();

			if (key == "fee_distribution_rate" && old_cfg.fee_distribution_rate() != value) {
				change = true;
				std::string value = election_cfg[key].asString();
				new_cfg.set_fee_distribution_rate(value);
			}
			else {
				int64_t value = election_cfg[key].asInt64();
				if (key == "pledge_amount" && old_cfg.pledge_amount() != value) {
					change = true;
					new_cfg.set_pledge_amount(value);
				}
				else if (key == "validators_refresh_interval" && old_cfg.validators_refresh_interval() != value) {
					change = true;
					new_cfg.set_validators_refresh_interval(value);
				}
				else if (key == "coin_to_vote_rate" && old_cfg.coin_to_vote_rate() != value) {
					change = true;
					new_cfg.set_coin_to_vote_rate(value);
				}
				else if (key == "fee_to_vote_rate" && old_cfg.fee_to_vote_rate() != value) {
					change = true;
					new_cfg.set_fee_to_vote_rate(value);
				}
				else if (key == "penalty_rate" && old_cfg.penalty_rate() != value) {
					change = true;
					new_cfg.set_penalty_rate(value);
				}
				else {
					LOG_ERROR("No such election configuration parameter %s", key.c_str());
				}
			}
		}

		return change;
	}

	Json::Value& Environment::GetValidators(){
		std::shared_ptr<Json::Value> validators;
		settings_.Get(validatorsKey, validators);

		if (!validators){
			validators = std::make_shared<Json::Value>();
			auto sets = LedgerManager::Instance().Validators();

			for (int i = 0; i < sets.validators_size(); i++){
				auto validator = sets.mutable_validators(i);
				Json::Value value;
				value.append(validator->address());
				value.append(utils::String::ToString(validator->pledge_coin_amount()));
				validators->append(value);
			}
			settings_.Set(validatorsKey, validators);
		}

		return *validators;
	}

	bool Environment::UpdateNewValidators(const Json::Value& validators) {
		return settings_.Set(validatorsKey, std::make_shared<Json::Value>(validators));
	}

	bool Environment::GetVotedValidators(const protocol::ValidatorSet &old_validator, protocol::ValidatorSet& new_validator){
		std::shared_ptr<Json::Value> validators;
		bool ret = settings_.Get(validatorsKey, validators);
		if (!validators){
			new_validator = old_validator;
			return false;
		}

		for (Json::Value::UInt i = 0; i < validators->size(); i++){
			std::string address = (*validators)[i][(Json::Value::UInt)0].asString();
			int64_t pledge_amount = utils::String::Stoi64( (*validators)[i][1].asString() );

			auto validator = new_validator.add_validators();
			validator->set_address(address);
			validator->set_pledge_coin_amount(pledge_amount);
		}

		return true;
	}

	bool Environment::GetValidatorCandidate(const std::string& addr, CandidatePtr& candidate){

		CandidatePtr cache = nullptr;
		if (candidates_.Get(addr, cache)){
			candidate = cache;
		}
		else{
			cache = ElectionManager::Instance().GetValidatorCandidate(addr);
			if (cache){
				candidate = std::make_shared<protocol::ValidatorCandidate>(*cache);
				candidates_.Set(addr, candidate);
			}
			else{
				candidate = nullptr;
				return false;
			}
		}
		return true;
	}

	bool Environment::SetValidatorCandidate(const std::string& addr, CandidatePtr candidate){
		return candidates_.Set(addr, candidate);
	}

	bool Environment::DelValidatorCandidate(const std::string& addr){
		return candidates_.Del(addr);
	}

	bool Environment::UpdateValidatorCandidate(){
		const CandidateMap& newCandidates = candidates_.GetData();

		for (auto it : newCandidates){
			if (it.second.type_ == utils::DEL){
				ElectionManager::Instance().DelValidatorCandidate(it.first);
			}
			else{
				if (!ElectionManager::Instance().SetValidatorCandidate(it.first, it.second.ptr_)){
					return false;
				}
			}
		}

		return true;
	}
}