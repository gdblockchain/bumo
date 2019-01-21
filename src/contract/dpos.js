'use strict';

const committeeKey      = 'committee';
const validatorCandsKey = 'validator_candidates';
const kolCandsKey       = 'kol_candidates';
const rewardKey         = 'block_reward';
const configKey         = 'dos_config';

const memberType = {
   'committee' : 1,
   'validator' : 2,
   'kol'       : 3
};

const motionType = {
    'apply'   :'application',
    'abolish' :'abolition',
    'withdraw':'withdraw'
};

let sysCfg = [];
let elect = {};
let cfg = {};

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

function electInit(){
    let rewards = loadObj(rewardKey);
    assert(rewards !== false, 'Faild to get all stake and reward distribution table.');

    elect.allStake = int64Add(rewards.allStake, thisPayCoinAmount);
    elect.distribution = rewards.distribution;

    elect.balance  = getBalance();
    assert(elect.balance !== false, 'Faild to get account balance.');

    elect.validatorCands = loadObj(validatorCandsKey);
    assert(elect.validatorCands !== false, 'Faild to get validator candidates.');

    elect.kolCands = loadObj(kolCandsKey);
    assert(elect.kolCands !== false, 'Faild to get kol candidates.');

    elect.validators = elect.validatorCands.slice(0, cfg.validatorsSize);
    elect.kols       = elect.kolCands.slice(0, cfg.kolsSize);
}

function distribute(twoDimenList, allReward){
    let reward = int64Div(allReward, twoDimenList.length);

    let i = 0;
    for(i = 0; i < twoDimenList.length; i += 1){
        let name = twoDimenList[i][0];
        if(elect.distribution[name] === undefined){
            elect.distribution[name] = reward;
        }
        else{
            elect.distribution[name] = int64Add(elect.distribution[name], reward);
        }
    }

    let left = int64Mod(allReward, twoDimenList.length);
    let element1st = elect.distribution[twoDimenList[0][0]];
    element1st = int64Add(element1st, left);
}

function rewardDistribution(){
    let rewards = int64Sub(elect.balance, elect.allStake);
    if(rewards === '0'){
        return;
    }

    let oneTenth = rewards / 10;
    distribute(elect.kols, oneTenth);
    distribute(elect.validators, oneTenth * 5);
    distribute(elect.validatorCands, oneTenth * 4);

    let left = rewards % 10;
    elect.distribution[elect.validators[0][0]] = int64Add(elect.distribution[elect.validators[0][0]], left);

    let distributed = {};
    distributed.allStake = getBalance();
    distributed.distribution = elect.distribution;
    saveObj(rewardKey, distributed);
}

function extract(){
    electInit();
    rewardDistribution();

    let income = elect.distribution[sender];
    transferCoin(sender, income);
    log(sender + ' extracted block reward ' + income);
}

function proposalKey(proposalType, memType, address){
    let key = '';
    if(memType === memberType.committee){
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
        'expiration':blockTimestamp + cfg.validPeriod,
        'ballot':[]
    };

    return proposal;
}

function checkPledge(type){
    let com = -1;

    if(type === memberType.validator){
        com = int64Compare(thisPayCoinAmount, cfg.validatorMinPledge);
        assert(com === 0 || com === 1, 'Quality deposit is less than the minimum pledge of validator.');
    }
    else if(type === memberType.kol){
        com = int64Compare(thisPayCoinAmount, cfg.kolMinPledge);
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
    let candidates = type === memberType.validator ? elect.validatorCands : elect.kolCands;
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

    if(type === memberType.validator && candidates.indexOf(node) < cfg.validatorsSize){
        let validators = candidates.slice(0, cfg.validatorsSize);
        setValidators(JSON.stringify(validators));
    }

    let key = type === memberType.validator ? validatorCandsKey : kolCandsKey;
    return saveObj(key, candidates);
}

function increaseStake(type, node, formalSize){
    let candidates = type === memberType.validator ? elect.validatorCands : elect.kolCands;
    let oldPos = candidates.indexOf(node);
    
    node[1] = int64Add(node[1], thisPayCoinAmount);
    candidates.sort(doubleSort);
    let newPos = candidates.indexOf(node);

    if(oldPos > formalSize && newPos <= formalSize){
        rewardDistribution();

        if(type === memberType.validator){
            let validators = candidates.slice(0, cfg.validatorsSize);
            setValidators(JSON.stringify(validators));
        }
    }

    let key = type === memberType.validator ? validatorCandsKey : kolCandsKey;
    return saveObj(key, candidates);
}

function decreaseStake(type, address, formalSize, amount){
    assert(type === memberType.validator || type === memberType.kol, 'Only validator and kol have candidate.');

    electInit();
    let candidates = type === memberType.validator ? elect.validatorCands : elect.kolCands;
    let node = candidates.find(function(x){
        return x[0] === address;
    });

    if(node === undefined){
        return true;
    }
    
    let oldPos = candidates.indexOf(node);
    node[1] = int64Sub(node[1], amount);
    candidates.sort(doubleSort);
    let newPos = candidates.indexOf(node);

    if(oldPos <= formalSize && newPos > formalSize){
        rewardDistribution();

        if(type === memberType.validator){
            let validators = candidates.slice(0, cfg.validatorsSize);
            setValidators(JSON.stringify(validators));
        }
    }

    let key = type === memberType.validator ? validatorCandsKey : kolCandsKey;
    return saveObj(key, candidates);
}

function updateCandidates(type, address, pledge){
    assert(type === memberType.validator || type === memberType.kol, 'Only validator and kol have candidate.');

    electInit();
    let candidates = type === memberType.validator ? elect.validatorCands : elect.kolCands;
    let node = candidates.find(function(x){
        return x[0] === address;
    });

    if(node === undefined && pledge !== undefined){
        let maxSize = type === memberType.validator ? cfg.validatorCandsSize : cfg.kolCandsSize;
        addCandidates(type, address, pledge, maxSize);
    }
    else{
        let formalSize = type === memberType.validator ? cfg.validatorsSize : cfg.kolsSize;
        increaseStake(type, node, formalSize);
    }
}

function deleteCandidate(type, address){
    assert(type === memberType.validator || type === memberType.kol, 'Only validator and kol have candidate.');

    electInit();
    let candidates = type === memberType.validator ? elect.validatorCands : elect.kolCands;
    let candidate = candidates.find(function(x){
        return x[0] === address;
    });

    if(candidate === undefined){
        return; 
    }

    rewardDistribution();

    let index = candidates.indexOf(candidate);
    candidates.splice(index, 1);
    candidates.sort(doubleSort);

    if(type === memberType.validator && index < cfg.validatorsSize){
        let validators = candidates.slice(0, cfg.validatorsSize);
        setValidators(JSON.stringify(validators));
    }

    let key = type === memberType.validator ? validatorCandsKey : kolCandsKey;
    saveObj(key, candidates);
}

function apply(type){
    let key = proposalKey(motionType.apply, type, sender);
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
        proposal.expiration = blockTimestamp + cfg.validPeriod;
        return saveObj(key, proposal);
    }

    /* Approved, additional deposit */
    saveObj(key, proposal);
    updateCandidates(type, sender, proposal.pledge);
}

function approveIn(type, applicant){
    let committee = loadObj(committeeKey);
    assert(committee !== false, 'Faild to get ' + committeeKey + ' from metadata.');
    assert(committee.includes(sender), 'Only committee members have the right to approve.');

    let key = proposalKey(motionType.apply, type, applicant);
    let proposal = loadObj(key);
    assert(proposal !== false, 'failed to get metadata: ' + key + '.');
        
    if(blockTimestamp >= proposal.expiration){
        transferCoin(applicant, proposal.pledge);
        return storageDel(key);
    }

    assert(proposal.ballot.includes(sender) !== true, sender + ' has voted.');
    proposal.ballot.push(sender);
    if(proposal.ballot.length <= parseInt(committee.length * cfg.inPassRate + 0.5)){
        return saveObj(key, proposal);
    }

    proposal.passTime = blockTimestamp;
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
    assert(committee !== false, 'Faild to get ' + committeeKey + ' from metadata.');
    assert(committee.includes(sender), 'Only committee members have the right to approve.');

    let key = proposalKey(motionType.abolish, type, evil);
    let proposal = loadObj(key);
    assert(proposal !== false, 'failed to get metadata: ' + key + '.');
        
    if(blockTimestamp >= proposal.expiration){
        return storageDel(key);
    }

    assert(proposal.ballot.includes(sender) !== true, sender + ' has voted.');
    proposal.ballot.push(sender);
    if(proposal.ballot.length <= parseInt(committee.length * cfg.outPassRate + 0.5)){
        return saveObj(key, proposal);
    }

    storageDel(key);
    if(type === memberType.committee){
        committee.splice(committee.indexOf(evil), 1);
        saveObj(key, committee);
    }
    else{
        deleteCandidate(type, evil);
        let applicantKey  = proposalKey(motionType.apply, type, evil);
        let applicant     = loadObj(applicantKey);
        assert(applicant !== false, 'Faild to get ' + applicantKey + ' from metadata.');

        let candidates = type === memberType.validator ? elect.validatorCands : elect.kolCands;
        distribute(candidates, applicant.pledge);
        storageDel(applicantKey);
    }
}

function voterKey(type, address){
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

    return key;
}

function vote(type, address){
    assert(addressCheck(address), address + ' is not valid adress.');

    let key = voterKey(type, address);
    let voteAmount = storageLoad(key);

    if(voteAmount === false){
        voteAmount = thisPayCoinAmount;
    }
    else{
        voteAmount = int64Add(voteAmount, thisPayCoinAmount);
    }

    storageStore(key, voteAmount);
    updateCandidates(type, address);
}

function unVote(type, address, amount){
    assert(addressCheck(address), address + ' is not valid adress.');
    assert(int64Compare(amount, 0) > 0, 'Unvote amount <= 0.');

    let key = voterKey(type, address);
    let votedAmount = storageLoad(key);
    assert(votedAmount !== false, 'The account did not vote for: ' + address);

    let com = int64Compare(amount, votedAmount);
    assert(com <= 0, 'Unvote number > voted number.');

    if(com === 0){
        storageDel(key);
    }
    else{
        storageStore(key, int64Sub(votedAmount, amount));
    }
    transferCoin(sender, amount);

    let formalSize = type === memberType.validator ? cfg.validatorsSize : cfg.kolsSize;
    decreaseStake(type, address, formalSize, amount);
}

function abolitionProposal(proof){
    let proposal = {
        'Informer': sender,
        'reason': proof,
        'expiration': blockTimestamp + cfg.validPeriod,
        'ballot': [sender]
    };

    return proposal;
}

function isExist(twoDimenList, address){
    let element = twoDimenList.find(function(x){
        return x[0] === address;
    });

    return element !== undefined;
}

function abolish(type, address, proof){
    assert(addressCheck(address), address + ' is not valid adress.');

    let committee = loadObj(committeeKey);
    assert(committee !== false, 'Faild to get ' + committeeKey + ' from metadata.');

    if(type === memberType.committee){
        assert(committee.includes(sender), 'Only committee members have the right to report other committee member.');
    }
    else if(type === memberType.validator){
        assert(isExist(elect.validators, sender), 'Only validator have the right to report other validator.');
    }
    else if(type === memberType.kol){
        assert(isExist(elect.kols, sender), 'Only kol have the right to report other kol.');
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

    proposal.expiration = blockTimestamp + cfg.validPeriod;
    saveObj(key, proposal);
}

function withdraw(type){
    let withdrawKey = proposalKey(motionType.withdraw, type, sender);
    let expiration = storageLoad(withdrawKey);

    if(expiration === false){
        return storageStore(withdrawKey, blockTimestamp + cfg.validPeriod);
    }

    let expired = int64Compare(blockTimestamp, expiration);
    assert(expired === 0 || expired === 1, 'Buffer period is not over.');

    let applicantKey = proposalKey(motionType.apply, type, sender);
    let applicant = loadObj(applicantKey);
    assert(applicant !== false, 'failed to get metadata: ' + applicantKey + '.');

    storageDel(applicantKey);
    storageDel(withdrawKey);

    if(type === memberType.committee){
        let committee = loadObj(committeeKey);
        assert(committee !== false, 'Faild to get ' + committeeKey + ' from metadata.');

        committee.splice(committee.indexOf(sender), 1);
        return saveObj(committeeKey, committee);
    }

    deleteCandidate(type, sender);

    if(elect.distribution[sender] === undefined){
        elect.distribution[sender] = applicant.pledge;
    }
    else{
        elect.distribution[sender] = int64Add(elect.distribution[sender], applicant.pledge);
    }
}

function configProposal(item, value){
    let proposal = {
        'item': item,
        'value': value,
        'expiration':blockTimestamp + cfg.validPeriod,
        'ballot':[sender]
    };

    return proposal;
}

function configure(item, value){
    assert(cfg[item] !== undefined, 'Configuration ' + item + ' cannot be changed.');

    let committee = loadObj(committeeKey);
    assert(committee !== false, 'Faild to get ' + committeeKey + ' from metadata.');
    assert(committee.includes(sender), 'Only the committee has the power to proposal to modify the configuration.');

    let key = sender + '_configure_' + item;
    let proposal = loadObj(key);
    if(proposal !== false && proposal.value === value){
        return;
    }

    proposal = configProposal(item, value);
    return saveObj(key, proposal);
}

function approveCfg(proposer, item){
    let committee = loadObj(committeeKey);
    assert(committee !== false, 'Faild to get ' + committeeKey + ' from metadata.');
    assert(committee.includes(sender), 'Only committee members have the right to approve.');

    let key = proposer + '_configure_' + item;
    let proposal = loadObj(key);
    assert(proposal !== false, 'failed to get metadata: ' + key + '.');
        
    if(blockTimestamp >= proposal.expiration){
        return storageDel(key);
    }

    assert(proposal.ballot.includes(sender) !== true, sender + ' has voted.');
    proposal.ballot.push(sender);
    if(proposal.ballot.length <= parseInt(committee.length * cfg.outPassRate + 0.5)){
        return saveObj(key, proposal);
    }

    storageDel(key);
    cfg[item] = proposal.value;
    saveObj(configKey, cfg);

    if(sysCfg.includes(item)){
        let sys = {};
        sys[item] = proposal.value;
        setSystemCfg(JSON.stringify(sys));
    }
}

function query(input_str){
    let input  = JSON.parse(input_str);

    let result = {};
    if(input.method === 'getValidators'){
        result.current_validators = getValidators();
    }
    else if(input.method === 'getCandidates'){
        result.current_candidates = storageLoad(validatorCandsKey);
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

    cfg = loadObj(configKey);
    assert(cfg !== false, 'Failed to load configuration.');

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
    else if(input.method === 'unVote'){
	    unVote(params.type, params.address, params.amount);
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
    else if(input.method === 'configure'){
    	configure(params.item, params.value);
    }
    else if(input.method === 'approveCfg'){
    	approveCfg(params.proposer, params.item);
    }
    else{
        throw '<undidentified operation type>';
    }
}

function init(input_str){
    cfg = {
        'committeeSize'      : 100,
        'kolsSize'           : 30,
        'kolCandsSize'       : 300,
        'kolMinPledge'       : 5000000000000,   /* 5 0000 0000 0000 */
        'validatorsSize'     : 30,
        'validatorCandsSize' : 300,
        'validatorMinPledge' : 500000000000000, /* 500 0000 0000 0000 */
        'inPassRate'         : 0.5,
        'outPassRate'        : 0.7,
        'validPeriod'        : 1296000000000    /* 15 * 24 * 60 * 60 * 1000 * 1000 */
    };
    saveObj(configKey, cfg);

    let committee = JSON.parse(input_str);
    assert(int64Compare(committee.length, cfg.committeeSize) <= 0, 'Committee size exceeded.');

    let i = 0;
    for(i = 0; i < committee.length; i += 1){
        assert(addressCheck(committee[i]), 'Committee member(' +committee[i] + ') is not valid adress.');
    }
    saveObj(committeeKey, committee);

    let validators = getValidators();
    assert(validators !== false, 'Get validators failed.');

    let candidates = validators.sort(doubleSort);
    saveObj(validatorCandsKey, candidates);

    let balance = getBalance();
    assert(balance !== false, 'Faild to get account balance.');

    let reward = {};
    reward.allStake     = balance;
    reward.distribution = {};
    saveObj(rewardKey, reward);

    return true;
}