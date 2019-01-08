let globalAttribute = {};
const globalAttributeKey = 'global_attribute';
const 1BU                = 100000000;

function feeValid(fee){
    let amount  = int64Sub(thisPayCoinAmount, fee);
    let realFee = int64Mul(amount, globalAttribute.feeRate) / 1BU;
    let trunc   = int64Mul(int64Div(realFee, 1000), 1000);

    let com = int64Compare(fee, trunc);
    return com === 0 || com === 1;
}

function ctpApproveValid(issuer, value){
    let arg = { 'method':'allowance', 'params':{ 'own':sender, 'spender':thisAddress } };
    let res = contractQuery(issuer, arg);

    return value === res.allowance;
}

function payAssetValid(asset){
    let x = asset.issuer === thisPayAsset.key.issuer;
    let y = asset.code === thisPayAsset.key.code;
    assert(x && y, 'Wrong ATP( issuer:' + asset.issuer + ', code:' + asset.code + ' ) paid.');

    return asset.value === thisPayAsset.amount;

}

function payCTP(issuer, from, to, value){
    let args = { 'method':'transferFrom', 'params':{ 'from':from, 'to':to, 'value':value}};
    payCoin(issuer, 0, args);
}

function makeOrder(own, target, fee, expiration){
    assert(blockTimestamp < expiration, 'Order date has expired.'); /*Need add time built-in interfacce*/
    //assert(stoI64Check(own.value) && stoI64Check(target.value), 'Target value must be alphanumeric.');

    if(own.issuer === undefined){ /* BU */
        assert(addressCheck(target.issuer), 'The peer asset issuance address is invalid.');
        assert(feeValid(fee), 'Invalid fee.');
    }
    else if(own.code === undefined){ /* CTP */
        assert(target.issuer === undefined, 'Must have a party asset is BU.');
        assert(ctpApproveValid(own.issuer, own.value), 'Insufficient payment of CTP(ctp address: ' + own.issuer + ', value: ' + own.value + ').');
    }
    else{ /* ATP */
        assert(target.issuer === undefined, 'Must have a party asset is BU.');
        assert(payAssetValid(own), 'Insufficient payment of ATP(issuer: ' + own.issuer + ' code: ' + own.code + ', value: ' + own.value + ').');
    }
    
    let orderKey   = 'order_' + (globalAttribute.orderInterval[1] + 1);
    let orderValue = {'maker': sender, 'own':own, 'target':target, 'fee':fee, 'expiration': expiration};
    storageStore(orderKey, JSON.stringify(orderValue));

    globalAttribute.orderInterval[1] = globalAttribute.orderInterval[1] + 1;
    storageStore(globalAttributeKey, JSON.stringify(globalAttribute));
}

function cancelOrder(key){
    let orderStr = storageLoad(key);
    assert(orderStr !== false, 'Order: ' + orderKey + ' does not exist');
    let order = JSON.parse(orderStr);

    if(order.own.issuer === undefined){ /* BU */
        payCoin(order.maker, int64Add(order.own.value, order.fee));
    }
    else if(order.own.code === undefined){ /* CTP */
        payCTP(order.own.issuer, thisAddress, order.maker, order.own.value);
    
    }
    else{ /* ATP */
        payAsset(order.maker, order.own.issuer, order.own.code, order.own.value);
    }

    storageDel(orderKey);
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

function partlyTakeOrder(orderKey, fee){
    let orderStr = storageLoad(orderKey);
    assert(orderStr !== false, 'Order: ' + orderKey + ' does not exist');
    let order = JSON.parse(orderStr);

    if(blockTimestamp > order.expiration){
        return cancelOrder(orderKey);
    }

    let bilateralFee = 0;
    if(order.target.issuer === undefined){ /* taker is BU */
        assert(feeValid(fee), 'Invalid fee.');
        bilateralFee = int64Add(fee, fee);

        let total = int64Add(order.target.value, fee);
        let com   = int64Compare(total, thisPayCoinAmount);
        if(com === 0 || com === 1){ /*full take*/
            payCoin(order.maker, int64Sub(order.target.value, fee));
            if(com === 1){ /* Return the excess*/
                payCoin(sender, int64Sub(thisPayCoinAmount, total); 
            }

            if(order.own.code === undefined){ /*maker is CTP*/
                payCTP(order.own.issuer, order.maker, sender, order.own.value);
            }
            else{ /*maker is ATP*/
                payAsset(sender, order.own.issuer, order.own.code, order.own.value);
            }
        } 
        else if(com === -1){ /* partial take */
            payCoin(order.maker, int64Sub(thisPayCoinAmount, bilateralFee));

            let partMake = int64Div(int64Mul(order.own.value, realTake), order.target.value));
            if(order.own.code === undefined){ /*maker is CTP*/
                payCTP(order.own.issuer, order.maker, sender, partMake);
            }
            else{ /*maker is ATP*/
                payAsset(sender, order.own.issuer, order.own.code, partMake);
            }

            order.fee = int64Sub(order.fee, fee);
            order.own.value = int64Sub(order.own.value, partMake);
            order.target.value = int64Sub(order.target.value, realTake);
            storageStore(orderKey, stringify(order));
        }
    }
    else if(order.target.code === undefined){ /*taker is CTP*/
        ctpApproveValid(order.target.issuer, order.target.value);

        bilateralFee = int64Add(order.own.fee, order.own.fee);
        payCTP(order.target.issuer, sender, order.maker, order.target.value);
        payCoin(sender, int64Sub(order.own.value, bilateralFee));
    }
    else{ /*take is ATP*/
        payAssetValid(order.target);

        bilateralFee = int64Add(order.own.fee, order.own.fee);
        payAsset(order.maker, thisPayAsset.key.issuer, thisPayAsset.key.code, thisPayAsset.amount);
        payCoin(sender, int64Sub(order.own.value, bilateralFee));
    }

    globalAttribute.serviceFee = int64Add(globalAttribute.serviceFee, bilateralFee);
    storageStore(globalAttributeKey, JSON.stringify(globalAttribute));
    storageDel(orderKey);
}

function takeOrder(orderKey, fee){
    let orderStr = storageLoad(orderKey);
    assert(orderStr !== false, 'Order: ' + orderKey + ' does not exist');
    let order = JSON.parse(orderStr);

    if(blockTimestamp > order.expiration){
        return cancelOrder(orderKey);
    }

    let bilateralFee = 0;
    if(order.target.issuer === undefined){ /* taker is BU */
        assert(feeValid(fee), 'Invalid fee.');

        bilateralFee = int64Add(fee, fee);
        payCoin(order.maker, int64Sub(thisPayCoinAmount, bilateralFee));

        if(order.own.code === undefined){ /*maker is CTP*/
            payCTP(order.own.issuer, order.maker, sender, order.own.value);
            tlog(orderKey, order.maker, (order.own.issuer + ':' +  order.own.value), sender, order.target.value);
        }
        else{ /*maker is ATP*/
            payAsset(sender, order.own.issuer, order.own.code, order.own.value);
            tlog(orderKey, order.maker, (order.own.issuer + ':' + order.own.code + ':' + order.own.value), sender, order.target.value);
        }
    }
    else if(order.target.code === undefined){ /*taker is CTP*/
        ctpApproveValid(order.target.issuer, order.target.value);

        bilateralFee = int64Add(order.own.fee, order.own.fee);
        payCTP(order.target.issuer, sender, order.maker, order.target.value);
        payCoin(sender, int64Sub(order.own.value, bilateralFee));

        tlog(orderKey, order.maker, order.own.value, sender, (order.target.issuer + ':' + order.target.value));
    }
    else{ /*take is ATP*/
        payAssetValid(order.target);

        bilateralFee = int64Add(order.own.fee, order.own.fee);
        payAsset(order.maker, thisPayAsset.key.issuer, thisPayAsset.key.code, thisPayAsset.amount);
        payCoin(sender, int64Sub(order.own.value, bilateralFee));

        tlog(orderKey, order.maker, order.own.value, sender, (order.target.issuer + ':' + order.target.code + ':' + order.target.value));
    }

    globalAttribute.serviceFee = int64Add(globalAttribute.serviceFee, bilateralFee);
    storageStore(globalAttributeKey, JSON.stringify(globalAttribute));
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
