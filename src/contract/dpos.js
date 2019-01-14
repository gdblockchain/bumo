'use strict';

const validatorSetSize       = 30;
const inPassRate             = 0.5;
const outPassRate            = 0.7;
const effectiveVoteInterval  = 15 * 24 * 60 * 60 * 1000 * 1000;
const validatorMinPledge     = 5000000 * 100000000;
const kolMinPledge           = 5 * 100000000;
const validatorCandidatesKey = 'validator_candidates';
const kolCandidatesKey       = 'kol_candidates';

const memberType = {
   'committee' : 1,
   'validator' : 2,
   'kol' : 3
};

function doubleSort(a, b){
    let com = int64Compare(b[1], a[1]) ;

    if(com === 0){
        return a[0] > b[0] ? 1 : -1;
    }

    return com;
}

function loadObj(key)
{
    let data = storageLoad(key);
    if(data !== false){
        return JSON.parse(data);
    }

    return false;
}

function delObj(key)
{
    storageDel(key);
    log('Delete (' + key + ') from metadata succeed.');
}

function saveObj(key, value)
{
    let str = JSON.stringify(value);
    storageStore(key, str);
    log('Set key(' + key + '), value(' + str + ') in metadata succeed.');
}

function transferCoin(dest, amount)
{
    if(amount === '0'){
        return true; 
    }

    payCoin(dest, amount);
    log('Pay coin( ' + amount + ') to dest account(' + dest + ') succeed.');
}

function getKey(type){
    let key = '';
    if(type == memberType.committee){
        key = 'apply_committee_' + sender; 
    }
    else if(type === member.validators){
        key = 'apply_validator_' + sender; 
    }
    else{
        key = 'apply_KOL_' + sender; 
    }

    return key;
}

function applyProposal(){
    let proposal = {
        'pledge':thisPayCoinAmount,
        'expiration':blockTimestamp + effectiveVoteInterval,
        'ballot':[]
    };

    return proposal;
}

function abolishProposal(proof){
    let proposal = {
        'Informer': sender,
        'reason': proof,
        'expiration': blockTimestamp + effectiveVoteInterval,
        'ballot': [sender]
    };

    return proposal;
}

function topX(set, n){
    let validators    = set.slice(0, n);
    let validatorsStr = JSON.stringify(validators);
    setValidators(validatorsStr);
    log('Set new validator sets(' + validatorsStr + ') succeed.');
    return true;
}

function apply(type){
    assert(type === memberType.committee && thisPayCoinAmount === '0', 'No deposit is required to apply to join the committee');

    let key = getKey(key);
    let proposal = loadObj(key);

    if(proposal === false){
        proposal = applyProposal();
        return saveObj(key, proposal);
    }

    assert(type !== memberType.committee, sender + ' has already applied for committee.');
    proposal.pledge = int64Add(proposal.pledge, thisPayCoinAmount);
    saveObj(key, proposal);

    if(proposal.passTime === undefined){
        return true;
    }

    let setKey = type === memberType.validators ? validatorCandidatesKey : kolCandidatesKey;
    let set = loadObj(setKey);
    let candidate = set.find(function(x){
        return x[0] === sender;
    });

    candidate[1] = int64Add(candidate[1], thisPayCoinAmount);
    set.sort(doubleSort);
    saveObj(setKey, set);
    if(set.indexOf(candidate) >= validatorSetSize){
        return true;
    }

    let validators = set.slice(0, validatorSetSize);
    let str = JSON.stringify(validators); 
    return setValidators(str);
}

function approveIn(type, address){

}

function vote(type, address){

}

function abolish(type, address, proof){

}

function approveOut(type){

}

function withdraw(type){

}


function setValidatorsFromCandidate(candidates){
    //candidates = candidates.sort(doubleSort);
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
        result.current_candidates = storageLoad(candidatesKey);
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
    	withdraw(params.type);
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
    storageStore(candidatesKey, str);

    return true;
}
