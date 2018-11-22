'use strict';

let effectiveAbolishVoteInterval = 15 * 24 * 60 * 60 * 1000 * 1000;
const passRate        = 0.7;
const abolishVar      = 'abolish_';
const proposerVar     = 'proposer';
const reasonVar       = 'reason';
const ballotVar       = 'ballot';
const expiredTimeVar  = 'voting_expired_time';

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

    if(candidate === false){
        let com = int64Compare(thisPayCoinAmount, validatorMinPledge);
        assert(com === 1 || com === 0, 'Pledge coin amount must more than ' + validatorMinPledge);
    }

    setValidatorCandidate(sender, thisPayCoinAmount);
}

function voteForCandidate(candidate, tokenAmount){
	assert(addressCheck(candidate) === true, 'Invalid candidate address.');
	assert(getValidatorCandidate(candidate) !== false, 'No such validator candidate');
	
	setVoteForCandidate(candidate, tokenAmount);
    return;
}

function takebackCoin(tokenAmount){
    let candidate = getValidatorCandidate(sender);
    assert(candidate !== false, 'Sender(' + sender + ') is not validator candidate.');

    let left = int64Sub(candidate.pledge, tokenAmount);
    let com = int64Compare(left, validatorMinPledge);
    if(com === -1){
        setValidatorCandidate(sender, '-'+ candidate.pledge);
        transferCoin(sender, candidate.pledge);
    }
    else{
        setValidatorCandidate(sender, '-'+ tokenAmount);
        transferCoin(sender, tokenAmount);
    }
    //bumo will update validator
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

	/*The votes of non-validators will discount 50%*/
    let halfVotes = 0;
    let i = 0;
    while(i < abolishProposal[ballotVar].length){
        if(findValidator(abolishProposal[ballotVar]) === false){
            halfVotes += 1;
        }
        i += 1;
    }
    let validVotes = Object.keys(abolishProposal[ballotVar]).length - parseInt(halfVotes * 0.5);

	let validators = getValidators();
    if(validVotes < parseInt(validators.length * passRate + 0.5)){
        setMetaData(abolishKey, abolishProposal);
        return true;
    }
	
	setValidatorCandidate(malicious, '-'+ candidate.pledge);
	if(findValidator(malicious) === true){
		validators = getValidators();
	}
	
    let forfeit = candidate.pledge;
    let award   = int64Mod(forfeit, validators.length);
    let average = int64Div(forfeit, validators.length);
    let index = 0;
    let newTokenAmount = 0;
	
    while(index < validators.length){
        candidate = getValidatorCandidate(validators[index][0]);
		if (index === 0) {
			newTokenAmount = candidate.pledge + average + award;
		} else {
			newTokenAmount = candidate.pledge + average;
		}
        setVoteForCandidate(validators[index][0], newTokenAmount);
        index += 1;
    }

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
            voteAbolishValidator(malicious);
        }
        else{
            log('Already abolished validator(' + malicious + ').'); 
        }
        return true;
    }

    let newProposal = {};
    newProposal[abolishVar]     = malicious;
    newProposal[reasonVar]      = proof;
    newProposal[proposerVar]    = sender;
    newProposal[expiredTimeVar] = blockTimestamp + effectiveAbolishVoteInterval;
    newProposal[ballotVar]      = [sender];

    setMetaData(abolishKey, newProposal);
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
    else{
        throw '<undidentified operation type>';
    }
}

function init(){
    return true;
}
