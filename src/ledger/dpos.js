'use strict';

const passRate            = 0.7;
const abolishVar          = 'abolish_';
const proposerVar         = 'proposer';
const reasonVar           = 'reason';
const ballotVar           = 'ballot';
const expiredTimeVar      = 'voting_expired_time';
const proposalRecordsKey  = 'proposalRecordsKey';
const voteRecordKeyPrefix = 'voteRecords_';
const nonceKey            = 'nonce';
const electionConfigKey   = 'configElection';

let effectiveVoteInterval = 15 * 24 * 60 * 60 * 1000 * 1000;
let proposalRecords = {};

function getObjectMetaData(key){
    assert(typeof key === 'string', 'Args type error, key must be a string.');

    let data = storageLoad(key);
    assert(data !== false, 'Failed to get ' + key + ' from metadata.');

    let value = JSON.parse(data);
    return value;
}

function setMetaData(key, value)
{
    assert(typeof key === 'string', 'Args type error. key must be a string.');

    if(value === undefined){
        storageDel(key);
        log('Delete (' + key + ') from metadata succeed.');
    }
    else{
        let strVal = JSON.stringify(value);
        storageStore(key, strVal);
        log('Set key(' + key + '), value(' + strVal + ') in metadata succeed.');
    }
}

function transferCoin(dest, amount)
{
    assert((typeof dest === 'string') && (typeof amount === 'string'), 'Args type error. arg-dest and arg-amount must be a string.');
    if(amount === '0'){ return true; }

    payCoin(dest, amount);
    log('Pay coin( ' + amount + ') to dest account(' + dest + ') succeed.');
}

function findValidator(addr){
    let validators = getValidators();

    let i = 0;
    while(i < validators.length){
        if(validators[i][0] === addr){
            return true;
        }
        i += 1;
    }

    return false;
}

function applyAsCandidate(){
    let candidate = getValidatorCandidate(sender);
    let configuration = getObjectMetaData(electionConfigKey);

    if(candidate === false){
        let com = int64Compare(thisPayCoinAmount, configuration.pledge_amount);
        assert(com === 1 || com === 0, 'Pledge coin amount must more than ' + configuration.pledge_amount);
    }

    setValidatorCandidate(sender, thisPayCoinAmount);
}

function voteForCandidate(candidate, tokenAmount){
	assert(addressCheck(candidate) === true, 'Invalid candidate address.');
	assert(getValidatorCandidate(candidate) !== false, 'No such validator candidate');
	
	setVoteForCandidate(candidate, tokenAmount);
	log(sender + ' vote for ' + candidate.address + ', with token amount ' + tokenAmount);
    return;
}

function takebackCoin(tokenAmount){
    let candidate = getValidatorCandidate(sender);
    let configuration = getObjectMetaData(electionConfigKey);
    assert(candidate !== false, 'Sender(' + sender + ') is not validator candidate.');

    let left = int64Sub(candidate.pledge, tokenAmount);
    let com = int64Compare(left, configuration.pledge_amount);
    if(com === -1){
        setValidatorCandidate(sender, '-' + candidate.pledge);
        transferCoin(sender, String(candidate.pledge));
    }
    else{
        setValidatorCandidate(sender, '-' + tokenAmount);
        transferCoin(sender, tokenAmount);
    }
    // bumo will update validator
}

function voteAbolishValidator(malicious){

    assert(addressCheck(malicious) === true, 'Invalid malicious address.');
    let abolishKey = abolishVar + malicious;
    let abolishStr = storageLoad(abolishKey);
    if(abolishStr === false){
        log(abolishKey + ' is not existed, voting maybe passed or expired.');
        return false;
    }

    let candidate = getValidatorCandidate(malicious);
    assert(candidate !== false, 'Malicious(' + sender + ') is not validator candidate.');
	assert(findValidator(sender) !== false, sender + ' has no permmition to abolish validator.'); 

    let abolishProposal = JSON.parse(abolishStr);
    if(blockTimestamp > abolishProposal[expiredTimeVar]){
        log('Voting time expired, clear abolish proposal.'); 
        setMetaData(abolishKey);
        return false;
    }
    
    assert(abolishProposal[ballotVar].includes(sender) !== true, sender + ' already voted.');
    abolishProposal[ballotVar].push(sender);

	// The votes of non-validators will discount 50%
    let halfVotes = 0;
    let i = 0;
    while(i < abolishProposal[ballotVar].length){
        if(findValidator(abolishProposal[ballotVar][i]) === false){
            halfVotes += 1;
        }
        i += 1;
    }
	
    let validVotes = abolishProposal[ballotVar].length - parseInt(halfVotes * 0.5);
	log('Total ballot is ' + abolishProposal[ballotVar].length + ', halfVotes is ' + halfVotes);
	
	let validators = getValidators();
    if(validVotes < parseInt(validators.length * passRate + 0.5)){
		log('ValidVotes ' + validVotes + ' less than ' + parseInt(validators.length * passRate + 0.5));
        setMetaData(abolishKey, abolishProposal);
        return true;
    }
	
    let forfeit = candidate.pledge;
    let left = int64Mod(forfeit, validators.length - 1);
    let average = int64Div(forfeit, validators.length - 1);
    let index = 0;
	let left_reward_index = 0;
	
    while(index < validators.length){
        candidate = getValidatorCandidate(validators[index][0]);
		if(candidate !== false && candidate.address === malicious) {
			if(index === 0) {
				left_reward_index = validators.length - 1; // left reward assign to the last one
			}
		} else if(candidate !== false) {
			if (index === left_reward_index) {
				setValidatorCandidate(validators[index][0], int64Add(left, average));
			} else {
				setValidatorCandidate(validators[index][0], average);
			}
		}
        index += 1;
    }
	setValidatorCandidate(malicious, '-' + candidate.pledge);
    setMetaData(abolishKey);
    return true;
}

function abolishValidator(malicious, proof){
    assert(addressCheck(malicious) === true, 'Invalid malicious address.');
    assert(typeof proof === 'string', 'Args type error, arg-proof must be string.'); 

    let validators = getValidators();
    assert(validators !== false, 'Failed to get validators.');
    assert(findValidator(sender) !== false, sender + ' has no permmition to abolish validator.'); 
    assert(findValidator(malicious) !== false, 'Current validator sets has no ' + malicious); 

    let abolishKey = abolishVar + malicious;
    let abolishStr = storageLoad(abolishKey);
    if(abolishStr !== false){
        let abolishProposal = JSON.parse(abolishStr);
        if(blockTimestamp >= abolishProposal[expiredTimeVar]){
            log('Update expired time of abolishing validator(' + malicious + ').'); 
            abolishProposal[expiredTimeVar] = blockTimestamp;
            setMetaData(abolishKey, abolishProposal);
        }
        else{
            log('Already abolished validator(' + malicious + ').'); 
        }
        return true;
    }

    let newProposal = {};
    newProposal[abolishVar.slice(0, -1)]     = malicious;
    newProposal[reasonVar]      = proof;
    newProposal[proposerVar]    = sender;
    newProposal[expiredTimeVar] = blockTimestamp + effectiveVoteInterval;
    newProposal[ballotVar]      = [sender];

    setMetaData(abolishKey, newProposal);
	log(sender + ' submit a new proposal, ' + JSON.stringify(newProposal));
    return true;
}

function quitAbolishValidator(malicious){
    assert(addressCheck(malicious) === true, 'Invalid malicious address.');

    let abolishKey = abolishVar + malicious;
    let abolishProposal = getObjectMetaData(abolishKey);
    assert(sender === abolishProposal[proposerVar], sender + ' is not proposer, has no permission to quit the abolishProposal.');

    setMetaData(abolishKey);
    return true;
}

function loadProposalRecords() {
	let result = storageLoad(proposalRecordsKey);
	if (result === false) {
		return false;
	}
	
	proposalRecords = JSON.parse(result);
	return true;
}

function proposalCfg(configuration) {
	let accountId = sender;
	assert(getValidatorCandidate(accountId) !== false, 'No such validator candidate');

	let result = storageLoad(nonceKey);
	assert(result !== false, 'Failed to load nonce');
	let nonce = parseInt(result);
	nonce+=1;
	let newProposalId = accountId + nonce;
	assert(loadProposalRecords() !== false, 'proposal records not exist');

	Object.keys(proposalRecords).forEach(function(proposalId) {
		if(proposalRecords[proposalId].accountId === accountId) {
			delete proposalRecords[proposalId];
			let key =voteRecordKeyPrefix + proposalId;
			storageDel(key);
			return false;			
		} else {
			return true;
		}
	});
  
    proposalRecords[newProposalId] = {'accountId':accountId, 'proposalId':newProposalId, 'configuration':configuration, 'voteCount': 1,'expireTime':blockTimestamp+effectiveVoteInterval};
    storageStore(proposalRecordsKey, JSON.stringify(proposalRecords));
    let v={};
    v[accountId] =1;
    storageStore(voteRecordKeyPrefix + newProposalId,JSON.stringify(v));  
	storageStore(nonceKey, nonce.toString());
}

function updateElectionConfiguration(newConfiguration) {
	let configuration = getObjectMetaData(electionConfigKey);
	Object.keys(newConfiguration).forEach(function(configItem) {
		if (configuration.hasOwnProperty(configItem)) {
			configuration[configItem] = newConfiguration[configItem];
			log('Update config item ' + configItem + ' to ' + newConfiguration[configItem]);
		}
		return true;  
	});
	storageStore(electionConfigKey, JSON.stringify(configuration));
}

function voteCfg(proposalId) {
	let accountId = sender;
	assert(getValidatorCandidate(accountId) !== false, 'No such validator candidate');
	assert(loadProposalRecords() !== false, 'Proposal records not exist');
	assert(proposalRecords.hasOwnProperty(proposalId) !== false, 'Vote proposal(' + proposalId + ') not exist');

	let key = voteRecordKeyPrefix + proposalId;
	if (blockTimestamp > proposalRecords[proposalId].expireTime) {
		delete proposalRecords[proposalId];
		storageStore(proposalRecordsKey, JSON.stringify(proposalRecords));
		storageDel(key);
		return false;
	}
  
    let proposalRecordBody = getObjectMetaData(key);
	assert(!proposalRecordBody.hasOwnProperty(accountId), 'Account(' + accountId + ') have voted the proposal(' + proposalId + ')'); 

	proposalRecords[proposalId].voteCount += 1;
	proposalRecordBody[accountId] = 1;
	
	let candidatesNum = Number(getCandidatesNumber());
	assert(candidatesNum > 0, 'Failed to get candidates number');
	
	let thredhold = parseInt(candidatesNum * passRate + 0.5);
	if(proposalRecords[proposalId].voteCount >= thredhold) {
		let newConfiguration = proposalRecords[proposalId].configuration;
		delete proposalRecords[proposalId];
		storageDel(key);   
		updateElectionConfiguration(newConfiguration);
		log('Election configuration has been update, new configuration: ' + JSON.stringify(newConfiguration));
	}
	else {
		storageStore(key,JSON.stringify(proposalRecordBody));
	}  
	storageStore(proposalRecordsKey, JSON.stringify(proposalRecords));
	return true;
}

function query(input_str){
    let input  = JSON.parse(input_str);

    let result = {};
    if(input.method === 'getValidators'){
        result.current_validators = getValidators();
    }
    else if(input.method === 'getCandidate'){
        result.candidate = getValidatorCandidate(input.address);
    }
    else if(input.method === 'getAbolishProposal'){
        result.abolish_proposal = storageLoad(abolishVar + input.params.address);
    }
	else if (input.method === 'getConfiguration') {
		result.configuration = getObjectMetaData(electionConfigKey);
	}
	else if (input.method === 'queryConfigProposal') {
		result.config_proposal = storageLoad(proposalRecordsKey);
	}
	else if (input.method === 'queryConfigVote') {
        assert(typeof input.params.proposalId === 'string', 'Arg-comments should be string'); 
        result.config_vote = storageLoad(voteRecordKeyPrefix + input.params.proposalId);
	}
    else{
       	throw '<unidentified operation type>';
    }

    log(result);
    return JSON.stringify(result);
}

function main(input_str){
    let input = JSON.parse(input_str);

    if(input.method === 'pledgeCoin'){
        applyAsCandidate();
    }
    else if(input.method === 'voteForCandidate'){
		assert(typeof input.params.address === 'string', 'Arg-address should be string');
		assert(typeof input.params.coinAmount === 'string', 'Arg-coinAmount should be string');
	    voteForCandidate(input.params.address, input.params.coinAmount);
    }
    else if(input.method === 'takebackCoin'){
	    takebackCoin(input.params.amount);
    }
    else if(input.method === 'abolishValidator'){
    	abolishValidator(input.params.address, input.params.proof);
    }
    else if(input.method === 'voteForAbolish'){
    	voteAbolishValidator(input.params.address);
    }
	else if(input.method === 'quitAbolish'){
    	quitAbolishValidator(input.params.address);
    }
    else if (input.method === 'proposalCfg') {
		assert(typeof input.params.configuration === 'object' && input.params.configuration !== null, 'Arg-configuration should be object');
		proposalCfg(input.params.configuration);
	}
	else if (input.method === 'voteCfg') {
		assert(typeof input.params.proposalId === 'string', 'Arg-proposalId should be string');
		voteCfg(input.params.proposalId);  
	}
    else{
        throw '<undidentified operation type>';
    }
}

function init(){
	storageStore(nonceKey,'0');
	storageStore(proposalRecordsKey, JSON.stringify(proposalRecords));
	
	let election_config = {};
	election_config.pledge_amount = 10000000000000;
	election_config.validators_refresh_interval = 24 * 60 * 60;
	election_config.coin_to_vote_rate = 1000;
	election_config.fee_to_vote_rate = 1000;
	election_config.fee_distribution_rate = '70:10:20';
	storageStore(electionConfigKey, JSON.stringify(election_config));
	
    return true;
}
