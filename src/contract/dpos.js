'use strict';

const validatorSetSize       = 30;
const inPassRate             = 0.5;
const outPassRate            = 0.7;
const effectiveVoteInterval  = 15 * 24 * 60 * 60 * 1000 * 1000;
const minPledgeAmount        = 5000000 * 100000000;
const applicantVar    = 'apply_';
const abolishVar      = 'abolish_';
const proposerVar     = 'proposer';
const reasonVar       = 'reason';
const ballotVar       = 'ballot';
const candidatesVar   = 'validator_candidates';
const pledgeAmountVar = 'pledge_coin_amount';
const expiredTimeVar  = 'voting_expired_time';

function doubleSort(a, b){
    let com = int64Compare(b[1], a[1]) ;

    if(com === 0){
        return a[0] > b[0] ? 1 : -1;
    }

    return com;
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

function findI0(arr, key){
    assert((typeof arr === 'object') && (typeof key === 'string'), 'Args type error. arg-arr must be an object, and arg-key must be a string.');

    let i = 0;
    while(i < arr.length){
        if(arr[i][0] === key){
            break;
        }
        i += 1;
    }

    if(i !== arr.length){
        return i;
    }
    else{
        return false;
    }
}

function insertCandidatesSorted(applicant, amount, candidates){
    assert(typeof applicant === 'string' && typeof amount === 'string' && typeof candidates === 'object', 'args error, arg-applicant and arg-amount must be string, arg-candidates must be arrary.');

    if(candidates.length >= (validatorSetSize * 2)){
        log('Validator candidates is enough.');
        return false;
    }

    if(candidates.length === 0){
        candidates.push([applicant, amount]);
        return candidates;
    }

    let i = 0;
    while(i < candidates.length){
        if(int64Compare(amount, candidates[i][1]) >= 0){ break; }
        i += 1;
    }

    if(i >= candidates.length){
        candidates.splice(i, 0, [applicant, amount]);
        return candidates;
    }

    if(amount === candidates[i][1]){
        while(i < candidates.length){
            if(applicant <= candidates[i][0] || int64Compare(amount, candidates[i][1]) > 0){ break; }
            i += 1;
        }
    }

    candidates.splice(i, 0, [applicant, amount]);
    return candidates;
}

function setValidatorsFromCandidate(candidates){
    let validators    = candidates.slice(0, validatorSetSize);
    let validatorsStr = JSON.stringify(validators);
    setValidators(validatorsStr);
    log('Set new validator sets(' + validatorsStr + ') succeed.');
    return true;
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
    else{
       	throw '<unidentified operation type>';
    }

    log(result);
    return JSON.stringify(result);
}

function main(input_str){
    let input = JSON.parse(input_str);
    let params = input.params;

    if(input.method === 'apply'){
        apply(params.type);
    }
    else if(input.method === 'approveIn'){
	    approveIn(params.type, params.address);
    }
    else if(input.method === 'vote'){
	    vote(params.type, params.address);
    }
    else if(input.method === 'abolish'){
    	abolish(params.type, params.address, params.proof);
    }
    else if(input.method === 'approveOut'){
    	approveOut(params.type, params.address);
    }
    else if(input.method === 'withdraw'){
    	withdraw(input.params.address);
    }
    else{
        throw '<undidentified operation type>';
    }
}

function init(input_str){
    let committee = JSON.parse(input_str);

    for(member in committee){
        assert(addressCheck(member) === true, 'Committee member(' + member + ') is not valid adress.');
    }

    let validators = getValidators();
    assert(validators !== false, 'Get validators failed.');

    let candidates = validators.sort(doubleSort);
    let str = JSON.stringify(candidates);
    storageStore(candidatesVar, str);

    return true;
}
