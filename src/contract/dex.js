let globalAttribute = {};
const globalAttributeKey = 'global_attribute';
const 1BU                = 100000000;

function feeValid(value, fee){
    assert(int64Add(value, fee) === thisPayCoinAmount, 'Insufficient BU paid.');

    let amount  = int64Sub(thisPayCoinAmount, fee);
    let realFee = int64Mul(amount, globalAttribute.feeRate) / 1BU;
    assert(realFee === fee, 'Insufficient fee.');
}

function ctpApproveValid(issuer, value){
    let arg = { 'method':'allowance', 'params':{ 'own':sender, 'spender':thisAddress } };
    let res = contractQuery(issuer, arg);
    assert(value === res.allowance, 'Insufficient CTP(contract address:' + issuer + ') paid.');
}

function payAssetValid(asset){
    let x = asset.issuer === thisPayAsset.key.issuer;
    let y = asset.code === thisPayAsset.key.code;
    let z = asset.value === thisPayAsset.amount;

    assert(x && y && z, 'Insufficient ATP( issuer:' + asset.issuer + ', code:' + asset.code + ' ) paid.');
}

function makeOrder(own, target, fee, expiration){
    assert(blockTimestamp < expiration, 'Order date has expired.'); /*Need add time built-in interfacce*/
    //assert(stoI64Check(own.value) && stoI64Check(target.value), 'Target value must be alphanumeric.');

    if(own.issuer === undefined){ /* BU */
        assert(addressCheck(target.issuer), 'The peer asset issuance address is invalid.');
        feeValid(own.value, fee);
    }
    else if(own.code === undefined){ /* CTP */
        assert(target.issuer === undefined, 'Must have a party asset is BU.');
        ctpApproveValid(own.issuer, own.value);
    }
    else{ /* ATP */
        assert(target.issuer === undefined, 'Must have a party asset is BU.');
        payAssetValid(own);
    }
    
    let orderKey   = 'order_' + (globalAttribute.orderInterval[1] + 1);
    let orderValue = {'maker': sender, 'own':own, 'target':target, 'fee':fee, 'expiration': expiration};
    storageStore(orderKey, JSON.stringify(orderValue));

    globalAttribute.orderInterval[1] = globalAttribute.orderInterval[1] + 1;
    storageStore(globalAttributeKey, JSON.stringify(globalAttribute));
}

/**
 * key  :order_n
 * value:{
 *     'maker':'buQxxxx',
 *     'own':{
 *         'issuer':buQyyy',
 *         'code':'GBP',
 *         'value':10000,
 *     },
 *    'target':{
 *        'value':1000,
 *     },
 *    'fee':5,
 *    'expiration':'2018...'
 * }
**/

function payCTP(issuer, from, to, value){
    let args = { 'method':'transferFrom', 'params':{ 'from':from, 'to':to, 'value':value}};
    payCoin(issuer, 0, args);
}

function takeOrder(orderKey, fee){
    let orderStr = storageLoad(orderKey);
    assert(orderStr !== false, 'Order: ' + orderKey + ' does not exist');
    let order = JSON.parse(orderStr);

    let bilateralFee = 0;
    if(order.target.issuer === undefined){ /* taker is BU */
        if(int64Add(order.target.value, fee) === thisPayCoinAmount){/*平单*/
            feeValid(order.target.value, fee);
            bilateralFee = int64Add(fee, fee);
            payCoin(order.maker, int64Sub(thisPayCoinAmount, bilateralFee));

            if(order.own.code === undefined){ /*maker is CTP*/
                let transferFrom = { 'method':'transferFrom', 'params':{ 'from':order.maker, 'to':sender, 'value':order.own.value}};
                payCoin(order.own.issuer, 0, transferFrom);
                tlog(orderKey, order.maker, (order.own.issuer + ':' +  order.own.value), sender, order.target.value);
            }
            else{ /*maker is ATP*/
                payAsset(sender, order.own.issuer, order.own.code, order.own.value);
                tlog(orderKey, order.maker, (order.own.issuer + ':' + order.own.code + ':' + order.own.value), sender, order.target.value);
            }
        }
    }
    else if(order.target.code === undefined){ /*taker is CTP*/
        let checkParam = { 'method':'allowance', 'params':{ 'own':sender, 'spender':thisAddress } };
        let res = payCoin(order.target.issuer, '0', checkParam);
        if(order.target.value === res.allowance){ /*平单*/
            bilateralFee = int64Add(order.own.fee, order.own.fee);

            let transferFrom = { 'method':'transferFrom', 'params':{ 'from':sender, 'to':order.maker, 'value':order.target.value}};
            payCoin(order.target.issuer, 0, transferFrom);
            payCoin(sender, int64Sub(order.own.value, bilateralFee));

            tlog(orderKey, order.maker, order.own.value, sender, (order.target.issuer + ':' + order.target.value));
        }
    }
    else{ /*take is ATP*/
        if((order.target.issuer === thisPayAsset.key.issuer) &&
           (order.target.code === thisPayAsset.key.code) && 
           (order.target.value === thisPayAsset.amount)){

            bilateralFee = int64Add(order.own.fee, order.own.fee);

            payAsset(order.maker, thisPayAsset.key.issuer, thisPayAsset.key.code, thisPayAsset.amount);
            payCoin(sender, int64Sub(order.own.value, bilateralFee));
            tlog(orderKey, order.maker, order.own.value, sender, (order.target.issuer + ':' + order.target.code + ':' + order.target.value));
        }
    }

    globalAttribute.serviceFee = int64Add(globalAttribute.serviceFee, bilateralFee);
    storageDel(orderKey);
}

function init(input_str){
    let params = JSON.parse(input_str).params;
    
    globalAttribute.owner = params.owner || sender;
    globalAttribute.feeRate = params.feeRate || 50000;
    globalAttribute.version = params.version || '1.0';
    globalAttribute.serviceFee = 0;
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
        takeOrder(input.params.order, input.params.fee);
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
