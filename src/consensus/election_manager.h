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

#ifndef ELECTION_MANAGER_H_
#define ELECTION_MANAGER_H_

#include <vector>
#include <string>
#include <unordered_map>
#include <proto/cpp/chain.pb.h>
#include <proto/cpp/consensus.pb.h>
#include <utils/headers.h>
#include <common/general.h>
#include <common/storage.h>
#include <common/pb2json.h>
#include <main/configure.h>
#include "ledger/kv_trie.h"

namespace bumo {
	typedef std::shared_ptr<protocol::ValidatorCandidate> CandidatePtr;

	class ElectionManager : 
		public utils::Singleton<bumo::ElectionManager>,
		public bumo::TimerNotify,
		public bumo::StatusModule  {
		friend class utils::Singleton<bumo::ElectionManager>;

	public:
		enum FeeSharerType {
			SHARER_USER = 0,
			SHARER_CREATOR = 1,
			SHARER_BLOCK_REWARD = 2,
			SHARER_MAX = 3
		};

		ElectionManager();
		~ElectionManager();

	public:
		bool Initialize();
		bool Exit();

		bool GetUpdateValidatorsFlag(){
			return update_validators_;
		}

		KVTrie* GetCandidateMpt(){
			return candidate_mpt_;
		}

		bool ReadSharerRate();
		const protocol::ElectionConfig& GetProtoElectionCfg();
		void SetProtoElectionCfg(const protocol::ElectionConfig& ecfg);
		bool ElectionConfigGet(protocol::ElectionConfig& ecfg);
		int32_t GetCandidatesNumber();
		static void ElectionConfigSet(std::shared_ptr<WRITE_BATCH> batch, const protocol::ElectionConfig &ecfg);
		bool UpdateElectionConfig(const protocol::ElectionConfig& ecfg);
		
		int64_t CoinToVotes(int64_t coin);
		int64_t FeeToVotes(int64_t fee);
		int64_t GetValidatorsRefreshInterval();

		uint32_t GetFeesSharerRate(FeeSharerType owner);

		void AddAbnormalRecord(const std::string& abnormal_node);
		void DelAbnormalRecord(const std::string& abnormal_node);
		void UpdateAbnormalRecords();

		bool SetValidatorCandidate(const std::string& key, CandidatePtr value);
		CandidatePtr GetValidatorCandidate(const std::string& key);
		void DelValidatorCandidate(const std::string& key);

		bool ValidatorCandidatesStorage();
		bool ValidatorCandidatesLoad();
		bool DynastyChange(Json::Value& validators_json);

		void UpdateToDB();

		virtual void OnTimer(int64_t current_time);
		virtual void OnSlowTimer(int64_t current_time);
		virtual void GetModuleStatus(Json::Value &data);

	private:
		struct PriorityCompare
		{
			/// Compare transactions by votes and ASCII string value.
			bool operator()(CandidatePtr const& l, CandidatePtr const& r) const
			{
				int64_t votes_l = l->coin_vote() + l->fee_vote();
				int64_t votes_r = r->coin_vote() + r->fee_vote();
				return (votes_l == votes_r) ? (l->address() < r->address()) : (votes_l < votes_r);
			}
		};

		protocol::ElectionConfig election_config_;
		std::unordered_map<std::string, int64_t> abnormal_records_;

		utils::ReadWriteLock candidates_mutex_;
		std::vector<std::string> to_delete_candidates_;
		std::unordered_map<std::string, CandidatePtr> validator_candidates_;
		bool update_validators_;
		KVTrie* candidate_mpt_;

		std::vector<uint32_t> fee_sharer_rate_;
	};

}

#endif
