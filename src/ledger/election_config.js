'use strict';
const proposalRecordsKey = 'proposalRecordsKey';
const voteRecordKeyPrefix = 'voteRecords_';
const nonceKey = 'nonce';
const passRate = 0.7;
const effectiveProposalInterval = 15 * 24 * 60 * 60 * 1000000;
let proposalRecords = {};

function loadProposalRecords() {
	let result = storageLoad(proposalRecordsKey);
	if (result === false) {
		return false;
	}
	
	proposalRecords = JSON.parse(result);
	return true;
}

function queryVote(proposalId) {
	let key = voteRecordKeyPrefix+proposalId;
	let result = storageLoad(key);
	if (result === false){
		result ='vote records of proposal(' + proposalId + ')not exist';
	}
	return result;
}

function queryProposal() {  
	let result = storageLoad(proposalRecordsKey);
	if(result === false){
		result ='No proposal of the election configuration exist';
	}
	return result;
}

function proposalCfg(params) {
	let accountId = sender;
	assert(getValidatorCandidate(accountId) !== false, 'No such validator candidate');

	let result = storageLoad(nonceKey);
	assert(result !== false, 'Failed to load nonce');
	let nonce = parseInt(result);
	nonce+=1;
	let newProposalId = accountId + nonce;
	assert(loadProposalRecords() !== false, 'proposal records not exist');

	let exist = false;
	Object.keys(proposalRecords).forEach(function(proposalId) {
		if(proposalRecords[proposalId].accountId === accountId) {
			exist = true;
			delete proposalRecords[proposalId];
			let key =voteRecordKeyPrefix + proposalId;
			storageDel(key);
			return false;			
		} else {
			return true;
		}
	});
  
	proposalRecords[newProposalId] = {'accountId':accountId, 'proposalId':newProposalId, 'configuration':params.configuration, 'voteCount': 1,'expireTime':blockTimestamp+effectiveProposalInterval};
	storageStore(proposalRecordsKey, JSON.stringify(proposalRecords));
	let v={};
	v[accountId] =1;
	storageStore(voteRecordKeyPrefix + newProposalId,JSON.stringify(v));  
	storageStore(nonceKey, nonce.toString());
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
  
	let proposalRecordBody = {};
	let result = storageLoad(key);
	assert(result !== false, 'proposalId(' + proposalId + ') not exist voteRecords');
	proposalRecordBody = JSON.parse(result);
	assert(!proposalRecordBody.hasOwnProperty(accountId), 'Account(' + accountId + ') have voted the proposal(' + proposalId + ')'); 

	proposalRecords[proposalId].voteCount += 1;
	proposalRecordBody[accountId] = 1;
	
	let candidatesNum = Number(getCandidatesNumber());
	assert(candidatesNum > 0, 'Failed to get candidates number');
	
	let thredhold = parseInt(candidatesNum * passRate + 0.5);
	if(proposalRecords[proposalId].voteCount >= thredhold) {
		let output = proposalRecords[proposalId].configuration;
		delete proposalRecords[proposalId];
		storageDel(key);   
		configElectionCfg(JSON.stringify(output));
	}
	else {
		storageStore(key,JSON.stringify(proposalRecordBody));
	}  
	storageStore(proposalRecordsKey, JSON.stringify(proposalRecords));
	return true;
}

function main(input) {
	let para = JSON.parse(input);

	if (para.method === 'proposalCfg') {
		assert(typeof para.configuration === 'object' && para.configuration !== null, 'Arg-configuration should be object');
		proposalCfg(para);
	}
	else if (para.method === 'voteCfg') {
		assert(typeof para.proposalId === 'string', 'Arg-proposalId should be string');
		voteCfg(para.proposalId);  
	}
	else {
		throw 'main input para error';
	}
}

function query(input) {
	let para = JSON.parse(input);
	if (para.method === 'queryProposal') {
		return queryProposal();
	}
	else if (para.method === 'queryVote') {
		assert(typeof para.params.proposalId === 'string', 'Arg-comments should be string'); 
		return queryVote(para.params.proposalId); 
	}
	else {
		throw 'query input para error';
	}
}

function init() {
	storageStore(nonceKey,'0');
	storageStore(proposalRecordsKey, JSON.stringify(proposalRecords));
}
