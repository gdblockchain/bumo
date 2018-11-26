'use strict';
function init(input_str){
    let params = JSON.parse(input_str).params;
    assert(stoI64Check(params.supply) === true, 'Args check failed.');
    let attribute = {};
    attribute.supply = params.supply;
    
    storageStore('global', JSON.stringify(attribute));
    storageStore(sender, attribute.supply);
}
