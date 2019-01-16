'use strict';

const kolSetSize                = 30;
const kolMinPledge              = 5 * 100000000;
const kolCandidateSetSize       = 300;
const validatorSetSize          = 30;
const validatorMinPledge        = 5000000 * 100000000;
const validatorCandidateSetSize = 300;
const inPassRate                = 0.5;
const outPassRate               = 0.7;
const effectiveVoteInterval     = 15 * 24 * 60 * 60 * 1000 * 1000;

const rewardKey                 = 'block_reward';
const committeeKey              = 'committee';
const kolCandidatesKey          = 'kol_candidates';
const validatorCandidatesKey    = 'validator_candidates';

const dpos = {};
const memberType = {
   'committee' : 1,
   'validator' : 2,
   'kol' : 3
};

const motionType = {
    'apply':'application',
    'abolish':'abolition',
    'withdraw':'withdraw',
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

function rewardInit(){
    dpos = loadObj(rewardKey);
    assert(dpos !== false, 'Faild to get all stake and reward distribution table.');

    dpos.allStake = int64Add(dpos.allStake, thisPayCoinAmount);
    dpos.balance  = getBalance();
    assert(dpos.balance !== false, 'Faild to get account balance.');

    dpos.validatorCandidates = loadObj(validatorCandidatesKey);
    assert(dpos.validatorCandidates !== false, 'Faild to get validator candidates.');

    dpos.kolCandidates = loadObj(kolCandidatesKey);
    assert(dpos.kolCandidates !== false, 'Faild to get kol candidates.');

    dpos.validators = dpos.validatorCandidates.slice(0, validatorSetSize);
    dpos.kols       = dpos.kolCandidates.slice(0, kolSetSize);
}

function distribute(twoDimenList, allReward){
    let reward = int64Div(allReward, twoDimenList.length);

    for(index in twoDimenList){
        let name = twoDimenList[index][0];
        if(dpos.distribution[name] === undefined){
            dpos.distribution[name] = reward;
        }
        else{
            dpos.distribution[name] = int64Add(dpos.distribution[name], reward);
        }
    }

    let left = int64Mod(allReward, twoDimenList.length);
    let element1st = dpos.distribution[twoDimenList[0][0]];
    element1st = int64Add(element1st, left);
}

function rewardDistribution(){
    let rewards = int64Sub(dpos.balance, dpos.allStake);
    if(rewards === '0'){
        return;
    }

    let validatorReward = (rewards * 5) / 10;
    distribute(dpos.validators, validatorReward);

    let nodeReward = (rewards * 4) / 10;
    distribute(dpos.validatorCandidates, nodeReward);

    let kolReward = rewards / 10;
    distribute(dpos.kols, kolReward);

    let left = rewards % 10;
    dpos.distribution[dpos.validators[0][0]] = int64Add(dpos.distribution[dpos.validators[0][0]], left);

    let distributed = {};
    distributed.allStake = getBalance();
    distributed.distribution = dpos.distribution;
    saveObj(rewardKey, distributed);
}

function extract(){
    rewardInit();
    rewardDistribution();

    let income = dpos.distribution[sender];
    transferCoin(sender, income);
    log(sender + ' extracted block reward ' + income);
}

function proposalKey(proposalType, memType, address){
    let key = '';
    if(memType == memberType.committee){
        key = proposalType + '_committee_' + address; 
    }
    else if(memType === memberType.validator){
        key = proposalType + '_validator_' + address; 
    }
    else if(memType === memberType.kol){
        key = proposalType + '_KOL_' + address; 
    }
    else{
        throw 'Unkown member type.';
    }

    return key;
}

function applicationProposal(){
    let proposal = {
        'pledge':thisPayCoinAmount,
        'expiration':blockTimestamp + effectiveVoteInterval,
        'ballot':[]
    };

    return proposal;
}

function checkPledge(type){
    let com = -1;

    if(type === memberType.validator){
        com = int64Compare(thisPayCoinAmount, validatorMinPledge);
        assert(com === 0 || com === 1, 'Quality deposit is less than the minimum pledge of validator.');
    }
    else if(type === memberType.kol){
        com = int64Compare(thisPayCoinAmount, kolMinPledge);
        assert(com === 0 || com === 1, 'Quality deposit is less than the minimum pledge of KOL.');
    }
    else if(type === memberType.committee){
        assert(thisPayCoinAmount === '0', 'No deposit is required to apply to join the committee');
    }
    else{
        throw 'Unkown member type.';
    }
}

function addCandidates(type, address, pledge, maxSize){
    let candidates = type === memberType.validator ? dpos.validatorCandidates : dpos.kolCandidates;
    let com = int64Compare(pledge, candidates[candidates.length - 1][1]);
    
    if(candidates.length >= maxSize && com <= 0){
        return;
    }

    rewardDistribution();

    let size = candidates.push([address, pledge]);
    let node = candidates[size - 1];

    candidates.sort(doubleSort);
    if(candidates.length > maxSize){
        candidates = candidates.slice(0, maxSize);
    }

    if(type === memberType.validator && candidates.indexOf(node) < validatorSetSize){
        let validators = candidates.slice(0, validatorSetSize);
        setValidators(JSON.stringify(validators));
    }

    let key = type === memberType.validator ? validatorCandidatesKey : kolCandidatesKey;
    return saveObj(key, candidates);
}

function modifyCandidates(type, node, formalSize){
    let candidates = type === memberType.validator ? dpos.validatorCandidates : dpos.kolCandidates;
    let oldPos = candidates.indexOf(node);
    
    node[1] = int64Add(node[1], thisPayCoinAmount);
    candidates.sort(doubleSort);
    let newPos = candidates.indexOf(node);

    if(oldPos > formalSize && newPos <= formalSize){
        rewardDistribution();

        if(type === memberType.validator){
            let validators = candidates.slice(0, validatorSetSize);
            setValidators(JSON.stringify(validators));
        }
    }

    let key = type === memberType.validator ? validatorCandidatesKey : kolCandidatesKey;
    return saveObj(key, candidates);
}

function updateCandidates(type, address, pledge){
    assert(type === memberType.validator || type === memberType.kol, 'Only validator and kol have candidate.');

    rewardInit();
    let candidates = type === memberType.validator ? dpos.validatorCandidates : dpos.kolCandidates;
    let node = candidates.find(function(x){
        return x[0] === address;
    });

    if(node === undefined){
        let maxSize = type === memberType.validator ? validatorCandidateSetSize : kolCandidateSetSize;
        addCandidates(type, address, pledge, maxSize);
    }
    else{
        let formalSize = type === memberType.validator ? validatorSetSize : kolSetSize;
        modifyCandidates(type, node, formalSize);
    }
}

function deleteCandidate(type, address){
    assert(type === memberType.validator || type === memberType.kol, 'Only validator and kol have candidate.');

    rewardInit();
    let candidates = type === memberType.validator ? dpos.validatorCandidates : dpos.kolCandidates;
    let candidate = candidates.find(function(x){
        return x[0] === address;
    });

    let index = committee.indexOf(candidate);
    if(index === -1){
        return; 
    }

    rewardDistribution();
    candidates.splice(index, 1);
    candidates.sort(doubleSort);

    if(type === memberType.validator && index < validatorSetSize){
        let validators = candidates.slice(0, validatorSetSize);
        setValidators(JSON.stringify(validators));
    }

    let key = type === memberType.validator ? validatorCandidatesKey : kolCandidatesKey;
    saveObj(key, candidates);
}

function apply(type){
    let key = proposalKey(motionType.apply, key, sender);
    let proposal = loadObj(key);

    if(proposal === false){
        /* first apply */
        checkPledge(type);
        proposal = applicationProposal();
        return saveObj(key, proposal);
    }

    proposal.pledge = int64Add(proposal.pledge, thisPayCoinAmount);
    if(proposal.passTime === undefined){ 
        /* Additional deposit, not yet approved */
        proposal.expiration = blockTimestamp + effectiveVoteInterval,
        return saveObj(key, proposal);
    }

    /* Approved, additional deposit */
    saveObj(key, proposal);
    updateCandidates(type, sender);
}

function approveIn(type, applicant){
    let committee = loadObj(committeeKey);
    assert(committee.includes(sender), 'Only committee members have the right to approve.');

    let key = proposalKey(motionType,apply, type, address);
    let proposal = loadObj(key);
    assert(proposal !== false, 'failed to get metadata: ' + key + '.');
        
    if(blockTimestamp >= proposal.expiration){
        transferCoin(applicant, proposal.pledge);
        return storageDel(key);
    }

    assert(proposal.ballot.includes(sender) !== true, sender + ' has voted.');
    proposal.ballot.push(sender);
    if(proposal.ballot.length <= parseInt(committee.length * inPassRate + 0.5)){
        return saveObj(key, proposal);
    }

    proposal.passTime === blockTimestamp;
    saveObj(key, proposal);

    if(type === memberType.committee){
        committee.push(applicant);
        return saveObj(key, committee);
    }
    else{
        return updateCandidates(type, applicant, proposal.pledge);
    }
}

function approveOut(type, evil){
    let committee = loadObj(committeeKey);
    assert(committee.includes(sender), 'Only committee members have the right to approve.');

    let key = proposalKey(motionType.abolish, type, address);
    let proposal = loadObj(key);
    assert(proposal !== false, 'failed to get metadata: ' + key + '.');
        
    if(blockTimestamp >= proposal.expiration){
        return storageDel(key);
    }

    assert(proposal.ballot.includes(sender) !== true, sender + ' has voted.');
    proposal.ballot.push(sender);
    if(proposal.ballot.length <= parseInt(committee.length * outPassRate + 0.5)){
        return saveObj(key, proposal);
    }

    storageDel(key);
    if(type === memberType.committee){
        committee.splice(committee.indexOf(evil), 1);
        return saveObj(key, committee);
    }
    else{
        deleteCandidate(type, evil);
        let recordKey  = proposalKey(motionType.apply, type, evil);
        let record     = loadObj(recordKey);
        let candidates = type === memberType.validator ? dpos.validatorCandidates : dpos.kolCandidates;
        distribute(candidates, record.pledge);
    }
}

function vote(type, address){
    let key = '';
    if(type === memberType.validators){
        key = 'voter_' + sender + '_validator_' + address;
    }
    else if(type === memberType.kol){
        key = 'voter_' + sender + '_kol_' + address;
    }
    else{
        throw 'Unkown voting type.';
    }

    let voteAmount = storageLoad(key);
    if(voteAmount === false){
        voteAmount = thisPayCoinAmount;
    }
    else{
        voteAmount = int64Add(voteAmount, thisPayCoinAmount);
    }

    storageStore(key, thisPayCoinAmount);
    updateCandidates(type, address);
}

function abolitionProposal(proof){
    let proposal = {
        'Informer': sender,
        'reason': proof,
        'expiration': blockTimestamp + effectiveVoteInterval,
        'ballot': [sender]
    };

    return proposal;
}

function checkPermission(type, address){

}

function abolish(type, address, proof){
    assert(addressCheck(address), address + ' is not valid adress.');

    let committee = loadObj(committeeKey);
    if(type === memberType.committee){
        assert(committee.includes(sender), 'Only committee members have the right to report other committee member.');
    }
    else if(type === memberType.validator){
        let node = dpos.validators.find(function(x){
            return x[0] === sender;
        });

        assert(node !== undefined, 'Only validator have the right to report other validator.');
    }
    else if(type === memberType.kol){
        let kol = dpos.kols.find(function(x){
            return x[0] === sender;
        });

        assert(kol !== undefined, 'Only kol have the right to report other kol.');
    }
    else{
        throw 'Unkown abolish type.';
    }

    let key = proposalKey(motionType.abolish, type, address);
    let proposal = loadObj(key);
    if(proposal === false){
        proposal = abolitionProposal(proof);
        saveObj(key, proposal);
    }

    proposal.expiration = blockTimestamp + effectiveVoteInterval;
    saveObj(key, proposal);
}

function withdraw(type){
    let withdrawKey = proposalKey(motionType.withdraw, type, sender);
    let expiration = storageLoad(withdrawKey);

    if(expiration === false){
        return storageStore(withdrawKey, blockTimestamp + effectiveVoteInterval);
    }

    let expired = int64Compare(blockTimestamp, expiration);
    assert(expired === 0 || expired === 1, 'Buffer period is not over.');

    let applicantKey = proposalKey(motionType.apply, type, sender);
    let applicant = loadObj(applicantKey);
    assert(applicant !== false, 'failed to get metadata: ' + applicantKey + '.');

    storageDel(applicantKey);
    storageDel(withdrawKey);

    if(type === memberType.committee){
        committee.splice(committee.indexOf(sender), 1);
        return saveObj(key, committee);
    }

    deleteCandidate(type, sender);

    if(dpos.distribution[sender] === undefined){
        dpos.distribution[sender] = applicant.pledge;
    }
    else{
        dpos.distribution[sender] = int64Add(dpos.distribution[sender], applicant.pledge);
    }
}

function query(input_str){
    let input  = JSON.parse(input_str);

    let result = {};
    if(input.method === 'getValidators'){
        result.current_validators = getValidators();
    }
    else if(input.method === 'getCandidates'){
        result.current_candidates = storageLoad(validatorCandidatesKey);
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
    else if(input.method === 'approveOut'){
    	approveOut(params.type, params.address);
    }
    else if(input.method === 'vote'){
	    vote(params.type, params.address);
    }
    else if(input.method === 'abolish'){
    	abolish(params.type, params.address, params.proof);
    }
    else if(input.method === 'withdraw'){
    	withdraw(params.type);
    }
    else if(input.method === 'extract'){
    	extract();
    }
    else{
        throw '<undidentified operation type>';
    }
}

function init(input_str){
    let committee = JSON.parse(input_str);
    for(index in committee){
        assert(addressCheck(committee[index]), 'Committee member(' +committee[index] + ') is not valid adress.');
    }
    saveObj(committeeKey, committee);

    let validators = getValidators();
    assert(validators !== false, 'Get validators failed.');

    let candidates = validators.sort(doubleSort);
    saveObj(validatorCandidatesKey, candidates);

    let balance = getBalance();
    assert(balance !== false, 'Faild to get account balance.');

    let reward= {};
    reward.allStake     = balance;
    reward.distribution = {};
    saveObj(rewardKey, reward);

    return true;
}
