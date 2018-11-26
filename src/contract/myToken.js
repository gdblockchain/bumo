'use strict';
function init(input_str){
    let params = JSON.parse(input_str).params;
    assert(stoI64Check(params.supply) === true, 'Args check failed.');
    let attribute = {};
    attribute.supply = params.supply;
    
    storageStore('global', JSON.stringify(attribute));
    storageStore(sender, attribute.supply);
}

function main(input_str){
    let input = JSON.parse(input_str);
    if(input.method === 'transfer'){
        transfer(input.params.to, input.params.value);
        return;
    }

    throw '<Main interface passes an invalid operation type>';
}

function query(input_str){
    let result = {};
    let input  = JSON.parse(input_str);

    if(input.method === 'balanceOf'){
        result.balance = balanceOf(input.params.address);
        return JSON.stringify(result);
    }

    throw '<Query interface passes an invalid operation type>';
}
