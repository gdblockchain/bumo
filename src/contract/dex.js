let globalAttribute = {};
const globalAttributeKey = 'global_attribute';
const 1BU = 100000000;

function makeOrder(own, target, fee, expiration){
    assert(blockTimestamp < expiration, 'Order date has expired.');
    assert(stoI64Check(target.value), 'Target value must be alphanumeric.');

    if(own.issuer === undefined){ /* BU */
        assert(addressCheck(target.issuer), 'The peer asset issuance address is invalid.');

        assert(int64Add(own.value, fee) === thisPayCoinAmount, 'Insufficient BU paid.');

        let amount  = int64Sub(thisPayCoinAmount, fee);
        let realFee = int64Mul(amount, globalAttribute.feeRate) / 1BU;
        assert(realFee === fee,'Insufficient fee.');
        
    }
    else if(own.code === undefined){ /* CTP */
        assert(target.issuer === undefined, 'Must have a party asset is BU.');

        let checkParam = { 'method':'allowance', 'params':{ 'owner':sender, 'spender':thisAddress } };
        let res = payCoin(own.issuer, '0', checkParam);
        assert(own.value === res.allowance, 'Insufficient CTP(contract address:' + own.issuer + ') paid.');
    }
    else{ /* ATP */
        assert(target.issuer === undefined, 'Must have a party asset is BU.');

        assert((own.issuer === thisPayAsset.key.issuer) &&
               (own.code === thisPayAsset.key.code)) &&
               (own.value === thisPayAsset.amount),
               'Insufficient ATP( issuer:' + own.issuer + ', code:' + own.code + ' ) paid.');
    }
    
    let orderKey   = 'order_' + (globalAttribute.orderInterval[1] + 1);
    let orderValue = {'own':own, 'target':target, 'fee':fee, 'expiration':expiration};
    storageStore(orderKey, JSON.stringify(orderValue));

    globalAttribute.orderInterval[1] = globalAttribute.orderInterval[1] + 1;
    storageStore(globalAttributeKey, JSON.stringify(globalAttribute));
}


function init(input_str){
    let params = JSON.parse(input_str).params;
    
    globalAttribute.owner = params.owner || sender;
    globalAttribute.feeRate = params.feeRate || 50000;
    globalAttribute.version = params.version || '1.0';
    globalAttribute.orderInterval = [0, 0];

    storageStore(globalAttributeKey, JSON.stringify(globalAttribute));
}

function main(input_str){
    let input = JSON.parse(input_str);
    globalAttribute = JSON.parse(storageLoad(globalAttributeKey));

    if(input.method === 'makeOrder'){
        makeOrder(input.params.own, input.params.target, input.params.fee, input.params.expiration);
    }
    else if(input.method === 'cancelOrder'){
        cancelOrder(input.params.order);
    }
    else if(input.method === 'takeOrder'){
        takeOrder(input.params.order);
    }
    else if(input.method === 'updateFeeRate'){
        updateFeeRate(input.params.rate);
    }
    else if(input.method === 'updateOwner'){
        updateOwner(input.params.owner);
    }
    else if(input.method === 'clearExpiredOrder'){
        clearExpiredOrder();
    }
    else if(input.method === 'withdrawFee'){
        withdrawFee(input.params.value);
    }
    else{
        throw '<Main interface passes an invalid operation type>';
    }
}

function query(input_str){

    let result = {};
    let input  = JSON.parse(input_str);

    if(input.method === 'dexInfo'){
        result.dexInfo = dexInfo();
    }
    else if(input.method === 'getOrder'){
        result.order = getOrder(input.params.order);
    }
    else if(input.method === 'getOrderInterval'){
        result.interval = getOrderInterval();
    }
    else{
       	throw '<Query interface passes an invalid operation type>';
    }
    return JSON.stringify(result);
}
