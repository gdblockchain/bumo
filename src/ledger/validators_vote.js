'use strict';

let effectiveVoteInterval = 24 * 60 * 60 * 1000 * 1000;
let minPledgeAmount       = 100000 * 100000000;
let minAdditionalAmount   = minPledgeAmount * 0.01;
const candidateSetSize    = 1000;
const passRate            = 0.7;
const abolishVar      = 'abolish_';
const proposerVar     = 'proposer';
const reasonVar       = 'reason';
const ballotVar       = 'ballot';
const candidatesVar   = 'validator_candidates';
const expiredTimeVar  = 'voting_expired_time';


function initCandidatesByValidators(validators){
    let i = 0;
    let candidates = {};

    while(i < validators.length){
        let data =[0, 0, 0]; //pledge, token vote, fee vote

        data[0] = validators[i][1];
        candidates[validators[i][0]] = data;
        i += 1;
    }

    return candidates;
}

function getObjectMetaData(key){
    assert(typeof key === 'string', 'Args type error, key must be a string.');

    let data = storageLoad(key);
    assert(data !== false, 'Get ' + key + ' from metadata failed.');

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

function applyAsCandidate(){
    let candidates = getObjectMetaData(candidatesVar);
    let com = 0;
    if(candidates[sender] !== undefined){
        com = int64Compare(thisPayCoinAmount, minAdditionalAmount);
        assert(com === 1 || com === 0, 'Additional coin amount must more than ' + minAdditionalAmount);

        candidates[sender][0] = int64Add(candidates[sender][0], thisPayCoinAmount);
    }
    else{
        com = int64Compare(thisPayCoinAmount, minPledgeAmount);
        assert(com === 1 || com === 0, 'Pledge coin amount must more than ' + minAdditionalAmount);

        if(candidates.length >= candidateSetSize){
            log('Validator candidates were enough.');
            return false;
        }

        let data =[thisPayCoinAmount, 0, 0];
        candidates[sender] = data;
    }

    return true;
}

function voteForCandidate(candidate, tokenAmount){
	assert(addressCheck(candidate) === true, 'Arg-candidate is not valid address.');
	assert(getValidateCandidate(candidate) !== false, 'No such validator candidate');
	
	assert(setVoteForCandidate(candidate, tokenAmount));
    return;
}

function quitCandidateStatus(){
    return;
}

function abolishValidator(malicious, proof){
    return;
}

function voteAbolishValidator(malicious){
    return;
}

function query(input_str){
    let input  = JSON.parse(input_str);

    let result = {};
    if(input.method === 'getValidators'){
        result.current_validators = getValidators();
    }
    else if(input.method === 'getCandidates'){
        result.current_candidates = storageLoad(candidatesVar);
    }
    else if(input.method === 'getAbolishProposal'){
        result.abolish_proposal = storageLoad(abolishVar + input.params.address);
    }
	else if(input.method === 'getAbnormalRecords') {
		result.abnormal_records = getAbnormalRecords();
	}
    else{
       	throw '<unidentified operation type>';
    }

    log(result);
    return JSON.stringify(result);
}

function main(input_str){
    let input = JSON.parse(input_str);

    if(input.method === 'applyAsCandidate'){
        applyAsCandidate();
    }
    else if(input.method === 'voteForCandidate'){
		assert(typeof input.params.address !== string, 'Arg-address should be string');
		assert(typeof input.params.coinAmount !== string, 'Arg-coinAmount should be string')
	    voteForCandidate(input.params.address, input.params.coinAmount);
    }
    else if(input.method === 'quitCandidateStatus'){
	    quitCandidateStatus();
    }
    else if(input.method === 'abolishValidator'){
    	abolishValidator(input.params.address, input.params.proof);
    }
    else if(input.method === 'voteForAbolish'){
    	voteAbolishValidator(input.params.address);
    }
    else{
        throw '<undidentified operation type>';
    }
}

function init(){
    let validators = getValidators();
    assert(validators !== false, 'Get validators failed.');

    let initCandidates = initCandidatesByValidators(validators);
    let candidateStr   = JSON.stringify(initCandidates);
    storageStore(candidatesVar, candidateStr);
	
    return true;
}
