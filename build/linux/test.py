#!/usr/bin/env python

import os
import sys
import requests
import getopt
import json
import time
import shutil
import random
import pdb

base_url = 'http://127.0.0.1:36002/'
election_js = './dpos.js'
election_addr = 'buQqzdS9YSnokDjvzg4YaNatcFQfkgXqk6ss'
keypairs = './keypairs'
genesis_account = 'buQnZpHB7sSW2hTG9eFefYpeCVDufMdmmsBF'
genesis_priv_key = ''
max_items = 1000 
debug=False
chainID = 0
server_port = 0

#validator_dict = {'buQBwe7LZYCYHfxiEGb1RE9XC9kN2qrGXWCY': 'privbyBW45wrDRhA4siS56T2mwu7UiHSADUKY1fr5V16FZTjb2KRfP3r'}
validator_dict = {'buQrVDKPCVE6LfCf8TyZEaiZ8R99NrSn4Fuz': 'privbx9sjcqQCTMoH1do1RY2HSQmiByRBWr7jMD919dk6P3y24AKLeGN',
                  'buQWQ4rwVW8RCzatR8XnRnhMCaCeMkE46qLR': 'privbvpMEg71oQFKAdevhzBbVqKwcdyxksvDvgs9th6Qpw8R1YeEH7Ty',
                  'buQBwe7LZYCYHfxiEGb1RE9XC9kN2qrGXWCY': 'privbyBW45wrDRhA4siS56T2mwu7UiHSADUKY1fr5V16FZTjb2KRfP3r',
                  'buQWBgAWSqiES7TNh1mq2VQwonvWtESz8Z2Z': 'privbtsYQnM5yVMx7UmfHCgUZ2sRkgNZPJH49WvoGREPpR69GoQb4QWi'}

CONTRACT_CMC_ADDRESS = "buQjjhxJhVDByQLSjQi4BEpDj9xTEHZbhbGe"
CONTRACT_CPC_ADDRESS = "buQZ6zAfmCVQBWTz5uVvMpMEdNGesLTJ888P"



class data_info:
    chain_id = 0
    amount = 0
    address = ''
    block_seq = 0
    seq = 0
    def __init__(self,chain_id,address='',amount=0,block_seq=0,seq=0):
        self.chain_id = chain_id
        self.amount = amount
        self.address = address
        self.block_seq = block_seq
        self.seq = seq

def usage():
    u = '''
    Name:
        %s - bumo python api test
    Synopsis:
        %s [-h] [-c command] [-p params]
        %s [-c genKeyPairs|testPayCoin|testCreateAccount|testIssueAsset] [-n number] [-o numOpPerTx] [-s startNonce] [-f keypairs]
        %s [-c dumpLedgerView] [-n span] [-o startSeq]
        %s [-c getTps] [-n startSeq] [-o endSeq]
        %s [-c testElection|testElectionConfig|testAbolish|testDauReward]
    Description:
        Arguments are as following:
            -h      print the help message
            -c      performance test:
                        genKeyPairs
                        testPayCoin
                        testCreateAccount
                        testIssueAsset
                        dumpLedgerView
                    get commands:
                        getModulesStatus
                        getAccount
                        getLedger
                        getTransactionHistory|th
                    list all commands:
                        list
    '''
    prog = os.path.basename(sys.argv[0])
    print 'Usage :'
    print u % (prog, prog, prog, prog, prog, prog)
    sys.exit(0)

def listCommands():
    ''' List all valid commands '''
    commands = '''
        hello
        createAccount
        getAccount
        getAccountBase
        getGenesisAccount
        getAccountMetaData
        getAccountAssets
        debug
        getTransactionBlob
        getTransactionHistory
        getTransactionCache
        getContractTx
        getStatus
        getLedger
        getModulesStatus
        getConsensusInfo
        updateLogLevel
        getAddress
        getTransactionFromBlob
        getPeerNodeAddress
        getLedgerValidators
        getPeerAddresses
        multiQuery
        submitTransaction
        confValidator
        contractQuery
        callContract
        testTransaction
'''
    print "Commands as follow:\n%s" % commands

def req(module, payload, post=False,dest_url = None):
    try:
        if not dest_url:
            dest_url = base_url
        if post:
            r = requests.post(dest_url + module, data=json.dumps(payload))
        else:
            r = requests.get(dest_url + module, params=payload)
            
        # print json.dumps(r.json(), indent=4)
        if r.ok:
            return r.json() 
        else:
            return None 
    except Exception,e:
        print str(e)
        return None

def newNonce(acc):
    ''' Get nonce value '''
    res = req('getAccount', {'address': acc})
    if res and res['error_code'] == 0:    
        if res['result'].has_key('nonce'):
            return res['result']['nonce'] + 1
        else:
            return 1
    else:
        print res
        return 0 

def callContract():
    ''' Call contract by contract account or payload '''
    payload = {
        "contract_address" : election_addr,
        "code" : "",
        "input": "{\"method\":\"getAbolishProposal\", \"params\": {\"address\": \"buQWBgAWSqiES7TNh1mq2VQwonvWtESz8Z2Z\"}}",
        "contract_balance" : "10000900000000",
        "fee_limit" : 100000000000,
        "gas_price": 1000,
        "opt_type" : 2,
        "source_address" : validator_dict.keys()[0]
    }

    print json.dumps(payload, indent=4)
    res = req('submitTransaction', payload, post=True)
    print res
    return True

def callContract_fun(contract_address,input_str,url=None):
    ''' Call contract by contract account or payload '''
    payload = {
        "contract_address" : contract_address,
        "code" : "",
        "input": input_str,
        "contract_balance" : "10000900000000",
        "fee_limit" : 100000000000,
        "gas_price": 1000,
        "opt_type" : 2,
        "source_address" : ""
    }

    #print json.dumps(payload, indent=4)
    try:
        res = req('callContract', payload, post=True,dest_url=url)
        #print res
        return res
    except Exception,e:
        print str(e)
        return None
    

def createContract(acc, nonce, contract=''):
    ''' Create account test '''

    # pdb.set_trace()
    payload = {
    'items': [{
        'private_keys': [genesis_priv_key],
        'transaction_json': {
            'fee_limit': '2000000000',
            'gas_price': 1000,
            'nonce': nonce, 
            'operations': [{
                'create_account': {
                    'dest_address': acc,
                    'init_balance': 200000000,
                     'contract': {
                        'payload': contract
                    },
                    'priv': {
                        'master_weight': 0,
                        'thresholds': {
                            'tx_threshold': '1'
                        }
                    }
                },
                'type': 1
            }],
            'source_address': genesis_account
        }
    }]
    }
    res = req('submitTransaction', payload, post=True)
    return res['results'][0]['error_code'] == 0

def applyAsFullnode(info_dict, nonce):
    ''' Make full node apply request
        info_dict: {address: endpoint}
        ex: {"buQs9npaCq9mNFZG18qu88ZcmXYqd6bqpTU3": "192.168.1.16:6331"}
    '''
    operations = []
    for addr in info_dict.keys():
        operations.append({ 
            "type": 7,
            "pay_coin": {
                "dest_address": election_addr,
                "amount": 0,
                "input": json.dumps({"method":"apply","params":{"address":addr, "endpoint":info_dict[addr]}})
            }
        })

    payload = {
        "items": [{
            "transaction_json": {
                "source_address": genesis_account,
                "nonce":nonce,
                "fee_limit": 2000000000,
                "gas_price": 1320,
                "operations": operations 
            },
            "private_keys": [genesis_priv_key]
        }]
    }
    #print json.dumps(payload, indent=4)
    res = req('submitTransaction', payload, post=True)
    #print res
    return res['results'][0]['error_code'] == 0

def genKeyPairs(number):
    ''' Generate keypair with the amount of number '''
    
    start = time.time()
    with open(keypairs, 'w') as f:
        for i in xrange(number):
            res = req('createAccount', {})
            if not res:
                print 'Failed to create account'
                return False
            else:
                account = {}
                account['address'] = res['result']['address']
                account['private_key'] = res['result']['private_key']
                f.write(json.dumps(account) + '\n')
     
    print 'Generate %s keypairs done in %.2f second' % (number, (time.time() - start))
    return

def addPayload(payload, op_type, acc_list, src_acc = {}, nonce = 1, amount = 0, nonce_pid = 1, candidate = '', meta = '7b7d',args=None):
    ''' Add new tx to payload
    Args:
        payload: payload with http request
        acc_list: dest account list
        nonce: sequence number of tx, equal to source_account.nonce+1
        src_acc: address and private key info of source account, ex: {"private_key":xx, "addresss":xx} 
    ''' 

    operations = []
    acc_priv_list = []
    fee_limit = 0

    if op_type == 'pay_coin': 
        for acc in acc_list:
            operations.append({
                    "type": 7,
                    "pay_coin": {
                    "dest_address" : acc,
                    "amount" : amount
                    }
                  })
        fee_limit = 10000000
    elif op_type == 'deposit':
        for acc in acc_list:
            operations.append({
                    "type": 7,
                    "pay_coin": {
                    "dest_address" : CONTRACT_CMC_ADDRESS,
                    "input":"{\"method\":\"depositToChildChain\",\"params\":{\"chain_id\":%d,\"amount\": \"%d\",\"address\": \"%s\"}}" % (args.chain_id,args.amount,acc),
                    "amount" : amount
                    }
                  })
        fee_limit = 10000000
    elif op_type == 'withdrawal':
        for acc in acc_list:
            operations.append({
                    "type": 7,
                    "pay_coin": {
                    "dest_address" : CONTRACT_CPC_ADDRESS,
                    "input":"{\"method\":\"withdrawal\",\"params\":{\"chain_id\":%d,\"address\": \"%s\",\"amount\": \"%d\"}}"  % (args.chain_id,acc,args.amount),
                    "amount" : amount
                    }
                  })
        fee_limit = 10000000
    elif op_type == 'withdrawal_client':
        for acc in acc_list:
            operations.append({
                    "type": 7,
                    "pay_coin": {
                    "dest_address" : CONTRACT_CMC_ADDRESS,
                    "input":"{ \"method\":\"withdrawalChildChain\",\"params\":{\"chain_id\":%d,\"amount\": \"%d\",\"block_seq\": \"%d\",\"seq\": \"%d\","\
                    "\"source_address\": \"%s\",\"address\": \"%s\",\"block_hash\": \"11ab\",\"merkel_proof\": \"64ebb\"}}"  % (args.chain_id,args.amount,args.block_seq,args.seq,acc,acc),
                    "amount" : amount
                    }
                  })
        fee_limit = 10000000
    elif op_type == 'create_account':
        for acc in acc_list:
            operations.append({
                'create_account': {
                    'dest_address': acc,
                    'init_balance': amount,
                    'priv': {
                        'master_weight': 1,
                        'thresholds': {
                            'tx_threshold': '1'
                        }
                    }
                },
                'type': 1
            })
        fee_limit = 10000000000
    elif op_type == 'issue_asset':
        for acc in acc_list:
            operations.append({
                'issue_asset': {
                    "amount": 1000,
                    "code": "CNY"
                },
                'source_address': acc['address'],
                'type': 2
            })
            acc_priv_list.append(acc['private_key'])
        fee_limit = 30000000000
    elif op_type == 'pledgeCoin': 
        for acc in acc_list:
            operations.append({
                    "type": 7,
                    "pay_coin": {
                    "dest_address" : acc,
                    "amount" :amount,
                    "input": "{\"method\":\"pledgeCoin\"}"
                    }
                  })
        fee_limit = 1000000000
    elif op_type == 'proposal': 
        for acc in acc_list:
            operations.append({
                    "type": 7,
                    "pay_coin": {
                    "dest_address" : acc,
                    "amount" : 0,
                    "input": "{\"method\":\"proposalCfg\", \"params\":{\"configuration\":{\"coin_to_vote_rate\": 2000,\"validators_refresh_interval\": 130, \"fee_distribution_rate\": \"60:10:30\"}}}"
                    }
                  })
        fee_limit = 1000000000
    elif op_type == 'voteCfg': 
        proposal_id = validator_dict.keys()[0] + str(nonce_pid)
        for acc in acc_list:
            operations.append({
                    "type": 7,
                    "pay_coin": {
                    "dest_address" : acc,
                    "amount" : 0,
                    "input": "{\"method\":\"voteCfg\", \"params\":{\"proposalId\": \"%s\"}}" % proposal_id
                    }
                  })
        fee_limit = 1000000000
    elif op_type == 'voteCandidate': 
        for acc in acc_list:
            operations.append({
                    "type": 7,
                    "pay_coin": {
                    "dest_address" : acc,
                    "amount" : 0,
                    "input": "{\"method\":\"voteForCandidate\", \"params\": {\"address\": \"%s\", \"coinAmount\": \"200000000\"}}" % candidate or validator_dict.keys()[0] 
                    }
                  })
        fee_limit = 100000000
    elif op_type == 'proposalAbolish': 
        for acc in acc_list:
            operations.append({
                    "type": 7,
                    "pay_coin": {
                    "dest_address" : acc,
                    "amount" : 0,
                    "input": "{\"method\":\"abolishValidator\", \"params\":{\"address\": \"%s\", \"proof\": \"see abnormal record\"}}" % validator_dict.keys()[-1]
                    }
                  })
        fee_limit = 1000000000
    elif op_type == 'voteAbolish': 
        for acc in acc_list:
            operations.append({
                    "type": 7,
                    "pay_coin": {
                    "dest_address" : acc,
                    "amount" : 0,
                    "input": "{\"method\":\"voteForAbolish\", \"params\":{\"address\": \"%s\"}}" % validator_dict.keys()[-1]
                    }
                  })
        fee_limit = 1000000000
    else:
        print 'Unknown type, %s' % op_type
        return
    
    if src_acc:
        src_addr = src_acc['address']
        priv_key = src_acc['private_key']
    else:
        src_addr = genesis_account
        priv_key = genesis_priv_key

    payload['items'].append({
        "transaction_json":{
          "source_address": src_addr,
          "metadata": meta,
          "nonce": nonce,
          "fee_limit": fee_limit,
          "chain_id": chainID,
          "gas_price": 1000,
          "operations": operations 
        },
       "private_keys": [priv_key] + acc_priv_list
    })
    
def getSpan(l, i, j):
    ''' Get slice from lines start from i with number j '''
    
    if i + j > len(l) - 1:
        return l[i+1:] + l[:j-(len(l)-1-i)]
    else:
        return l[i+1:i+1+j]

def sendRequest(payload,url=None):
    ''' send request to bumo '''
    if not url:
        url = base_url

    success_count = 0
    p = {'items':[]}
    for i in xrange(len(payload['items'])):
        if i+1 % max_items == 0:
            time.sleep(5)
            res = req('submitTransaction', p, post=True,dest_url=url)
            with open('./test.log', 'a') as f:
                f.write(json.dumps(res, indent=4))
            print res
            err_list = []
            for err in res['results']:
                if err['error_code'] != 0:
                    err_list.append(err)
            if len(err_list) > 0:
                if debug:
                    print err_list
                else:
                    pass
            success_count += res['success_count']
            p = {'items':[]}
        else:
            p['items'].append(payload['items'][i])
    if len(p['items']) > 0:
        res = req('submitTransaction', p, post=True,dest_url=url)
        if not res:
            return 0
        print res
        with open('./test.log', 'a') as f:
            f.write(json.dumps(res, indent=4))
        err_list = []
        for err in res['results']:
            if err['error_code'] != 0:
                err_list.append(err)
        if len(err_list) > 0:
            if debug:
                print err_list
            else:
                pass
        success_count += res['success_count']
    return success_count

def testCreateAccount(numTx, numOpPerTx,num =5030000000):
    ''' Performance test of create account
    Args:
        numTx: total number of accounts to create
        numOpPerTx: number of accounts to create per transaction
    '''
    
    genKeyPairs(numTx * numOpPerTx)
    #pdb.set_trace()
    acc_list = []
    payload = {'items':[]}
    n = newNonce(genesis_account)
    with open(keypairs, 'r') as f:
        for line in f:
            acc_list.append(json.loads(line.strip())['address'])
            if len(acc_list) == numOpPerTx:
                addPayload(payload, 'create_account', acc_list, nonce=n, amount=num)
                n += 1
                acc_list = []
            else:
                continue
    #print json.dumps(payload, indent=4)
    if acc_list:
        addPayload(payload, 'create_account', acc_list, nonce=n, amount=num)
    success_count = sendRequest(payload)

    print 'Create accounts test done, %s succeed, %s failed' % (success_count, numTx - success_count)
    return

def testPayCoin(numTx, numOpPerTx, start_nonce = 0):
    ''' Performance test of pay coin 
    Args:
        numTx: total number of accounts to create
        numOpPerTx: number of accounts to create per transaction
    '''

    lines = []
    send_dict = {}    
    acc_list = []
    with open(keypairs, 'r') as f:
        lines = f.readlines() 

    payload = {'items':[]}
    for i in xrange(numTx):
        if not start_nonce:
            m = random.randint(0, len(lines) - 1)
            acc_list = [json.loads(acc)['address'] for acc in getSpan(lines, m, numOpPerTx)]
            #acc_list = [genesis_account]
            # increase nonce value if address has been used 
            addr_info = json.loads(lines[m])
            addr = addr_info['address']
            if addr in send_dict.keys():
                send_dict[addr] += 1
            else:
                send_dict[addr] = newNonce(addr)
            nonce = send_dict[addr]
        else:
            idx = i
            if i > (len(lines) - 1):
                idx = i % len(lines)
                start_nonce += 1
            acc_list = [json.loads(acc)['address'] for acc in getSpan(lines, idx, numOpPerTx)]
            #acc_list = [genesis_account]
            addr_info = json.loads(lines[idx])
            nonce = start_nonce
        
        addPayload(payload, 'pay_coin', acc_list, addr_info, nonce, amount=4900000000)

    success_count = sendRequest(payload)
    
    print 'Pay coin test done, %s tx succeed, %s tx failed' % (success_count, numTx - success_count)
    return

def testIssueAsset(numTx, numOpPerTx, start_nonce = 0):
    ''' Performance test of issue asset 
    Args:
        numTx: total number of accounts to create
        numOpPerTx: number of accounts to create per transaction
    '''
    
    lines = []
    send_dict = {}    
    acc_list = []
    with open(keypairs, 'r') as f:
        lines = f.readlines() 

    payload = {'items':[]}
    for i in xrange(numTx):
        if not start_nonce:
            m = random.randint(0, len(lines) - 1)
            acc_list = [json.loads(acc) for acc in getSpan(lines, m, numOpPerTx)]
            # increase nonce value if address has been used 
            addr_info = json.loads(lines[m])
            addr = addr_info['address']
            if addr in send_dict.keys():
                send_dict[addr] += 1
            else:
                send_dict[addr] = newNonce(addr)
            nonce = send_dict[addr]
        else:
            idx = i
            if i > (len(lines) - 1):
                idx = i % len(lines)
                start_nonce += 1
            acc_list = [json.loads(acc) for acc in getSpan(lines, idx, numOpPerTx)]
            addr_info = json.loads(lines[idx])
            nonce = start_nonce
        
        addPayload(payload, 'issue_asset', acc_list, addr_info, nonce)

    success_count = sendRequest(payload)

    print 'Issue asset test done, %s tx succeed, %s tx failed' % (success_count, numTx - success_count)
    return

def testElection(info_dict = {}):
    nonce = newNonce(genesis_account)
    ret = req('getAccount', election_addr)
    if ret['error_code'] != 0:
        print "Try to create contract"
        if not createContract(election_addr, nonce, open(election_js, 'r').read()):
            sys.exit(1)
        else:
            nonce+=1
            print 'Create election contract done'

    addr_list = []
    info_dict = info_dict or validator_dict
    for addr in validator_dict.keys():
        addr_list.append(addr)
    print "Try to pay coin to candidate account"
    payload = {'items':[]}
    addPayload(payload, 'pay_coin', addr_list, {}, nonce, amount=20000300000000)
    success_count = sendRequest(payload)
    print 'Success tx %s' % success_count
    
    addr_json = {'address': addr_list[-1]}
    cnt = 10
    while True:
        if cnt <= 0:
            break
        ret = req('getAccount', addr_json)
        if ret['error_code'] != 0:
            time.sleep(1)
        else:
            balance = ret['result']['balance']
            if balance < 10000000300000:
                time.sleep(1)
                print 'Balance %s not enough for %s' % (balance, 10000000300000)
            else:
                break
        cnt -= 1

    print "Try to apply as candidate"
    payload = {'items':[]}
    for key in info_dict.keys(): 
        nonce_v = newNonce(key)
        src_dict = {'address':key, 'private_key': info_dict[key]}
        addPayload(payload, 'pledgeCoin', [election_addr], src_dict, nonce_v, amount=10000000000000)
    success_count = sendRequest(payload)

    print 'Success tx %s' % success_count

def testAbolish(acc_nonce=1):
    ''' Abolish validator '''
    # proposal
    proposal_addr = validator_dict.keys()[0]
    nonce_p = newNonce(proposal_addr)
    payload = {'items':[]}
    info_dict = {'address': proposal_addr, 'private_key': validator_dict[proposal_addr]}
    addPayload(payload, 'proposalAbolish', [election_addr], info_dict, nonce_p)
    success_count = sendRequest(payload)
    print 'Success tx %s' % success_count
    time.sleep(6)
    
    # vote    
    payload = {'items':[]}
    for key in validator_dict.keys()[1:]: 
        src_dict = {'address':key, 'private_key': validator_dict[key]}
        nonce_v = newNonce(key)
        addPayload(payload, 'voteAbolish', [election_addr], src_dict, nonce_v, nonce_pid=acc_nonce)
    success_count = sendRequest(payload)

    print 'Success tx %s' % success_count

def testElectionConfig(acc_nonce=1):
    print 'Proposal a new election configuration'
    proposal_addr = validator_dict.keys()[0]
    nonce_p = newNonce(proposal_addr)
    payload = {'items':[]}
    proposal_dict = {'address': proposal_addr, 'private_key': validator_dict[proposal_addr]}
    addPayload(payload, 'proposal', [election_addr], proposal_dict, nonce_p)
    success_count = sendRequest(payload)
    print 'Success tx %s' % success_count
    
    print 'Vote for new election configuration'
    payload = {'items':[]}
    for key in validator_dict.keys()[1:]: 
        nonce_v = newNonce(key)
        src_dict = {'address':key, 'private_key': validator_dict[key]}
        addPayload(payload, 'voteCfg', [election_addr], src_dict, nonce_v, nonce_pid=acc_nonce)
    success_count = sendRequest(payload)
    print 'Success tx %s' % success_count

def testDauReward(total_account = 10):
    ''' Dau reward test '''

    print 'Create accounts' 
    genKeyPairs(total_account)
    acc_list = []
    payload = {'items':[]}
    n = newNonce(genesis_account)
    lines = []
    with open(keypairs, 'r') as f:
        lines = f.readlines()

    for line in lines:
        acc_list.append(json.loads(line.strip())['address'])
    addPayload(payload, 'create_account', acc_list, nonce=n, amount=1000000000)
    success_count = sendRequest(payload)
   
    addr_json = {'address': acc_list[-1]}
    cnt = 10
    while True:
        if cnt <= 0:
            break
        ret = req('getAccount', addr_json)
        if ret['error_code'] != 0:
            time.sleep(1)
        else:
            balance = ret['result']['balance']
            if balance < 1000000000:
                time.sleep(1)
                print 'Balance %s not enough for %s' % (balance, 1000000000)
                return
            else:
                break
        cnt -= 1
    print 'Create accounts done'
    
    # vote for
    print 'Set vote for address'
    addr_list = []
    for addr in validator_dict:
        addr_list.append(addr)

    payload = {'items':[]}
    src_info = {}
    for i in xrange(total_account / 2):
        src_info['address'] = json.loads(lines[i].strip())['address']
        src_info['private_key'] = json.loads(lines[i].strip())['private_key']
        vote_for = addr_list[i%len(addr_list)]
        addPayload(payload, 'voteCandidate', [election_addr], src_info, candidate=vote_for)
    success_count = sendRequest(payload)

    addr_json = {'address': acc_list[4]}
    cnt = 10
    while True:
        if cnt <= 0:
            break
        ret = req('getAccount', addr_json)
        if ret['error_code'] != 0:
            time.sleep(1)
        else:
            if 'vote_for' in ret['result'].keys():
                break
            else:
                print 'wait 1 second ...' 
                time.sleep(1)
        cnt -= 1
    print 'Set vote for done'

    ret = req('getAccount', {'address': genesis_account})
    print "%s:%s" % (genesis_account, ret['result']['balance'])

    print 'Paycoin from [0:half] to [half:]'

    dapp_str_list = ['7b2266726f6d5f6163636f756e74223a20226275515742674157537169455337544e68316d71325651776f6e76577445537a385a325a222c20227368617265223a20223530227d',
                     '7b2266726f6d5f6163636f756e74223a20226275517168683846515752577053714a3361576757536d485338344e6e4e765353445338222c20227368617265223a20223530227d',
                     '7b2266726f6d5f6163636f756e74223a2022627551427765374c5a59435948667869454762315245395843396b4e3271724758574359222c20227368617265223a20223530227d',
                     '7b2266726f6d5f6163636f756e74223a20226275517256444b50435645364c6643663854795a4561695a385239394e72536e3446757a222c20227368617265223a20223530227d']

    payload = {'items':[]}
    src_info = {}
    for i in xrange(total_account / 2):
        src_info['address'] = json.loads(lines[i].strip())['address']
        src_info['private_key'] = json.loads(lines[i].strip())['private_key']
        dst_addr = json.loads(lines[i+total_account/2].strip())['address']
        dapp_str = dapp_str_list[i%len(dapp_str_list)]
        addPayload(payload, 'pay_coin', [dst_addr], src_info, nonce=2, amount=100000000, meta=dapp_str)
    success_count = sendRequest(payload)
        
    addr_json = {'address': acc_list[-1]}
    cnt = 10
    while True:
        if cnt <= 0:
            break
        ret = req('getAccount', addr_json)
        if ret['error_code'] != 0:
            time.sleep(1)
        else:
            balance = ret['result']['balance']
            if balance > 900000000:
                print 'wait 1 second ...' 
                time.sleep(1)
            else:
                break
        cnt -= 1
    print 'Paycoin from [0:half] to [half:] done'
    lines.append(json.dumps({'address': genesis_account}))
    for line in lines:
        addr = json.loads(line.strip())['address']
        addr_json = {'address': addr}
        ret = req('getAccount', addr_json)
        if ret['error_code'] == 0:
            balance = ret['result']['balance']
            print '%s:%s' % (addr, str(balance))
        else:
            print json.dumps(ret, indent=4)
    return


deposit_list = []
already_withdrawal_list = {}

def PayCoin2LocalAccount():
    lines = []
    send_dict = {}    
    acc_list = []
    with open(keypairs, 'r') as f:
        lines = f.readlines() 

    payload = {'items':[]}

    acc_list = [json.loads(acc)['address'] for acc in getSpan(lines, 0, 10)]
    nonce = newNonce(genesis_account)

    addPayload(payload, 'pay_coin', acc_list, {}, nonce, amount=20000000000000)
    success_count = sendRequest(payload)
    return

def test_deposit_withdrawal(chain_id):

    global chainID
    chainID = chain_id
    lines = []

    if chainID != 0:
        PayCoin2LocalAccount()
    temp_chain_id = 1
    while 1:
        if chainID == 0:
            if not os.path.exists(keypairs):
                testCreateAccount(10, 1,1000000000000)
                time.sleep(30)
            with open(keypairs, 'r') as f:
                    lines = f.readlines() 
            src_info = {}
            m = random.randint(0, len(lines) - 1)
            #acc_list = [json.loads(acc)['address'] for acc in getSpan(lines, m, 1)]
            src_info['address'] = json.loads(lines[m].strip())['address']
            src_info['private_key'] = json.loads(lines[m].strip())['private_key']

            deposit(temp_chain_id,src_info)
            temp_chain_id = temp_chain_id%3 +1
            time.sleep(60)

            withdrawal_client()
            
        else:
            withdrawal()
            time.sleep(70)

    return



def deposit(chainId,src_info):
    ''' deposit 
    Args:
        numTx: total number of accounts to create
        numOpPerTx: number of accounts to create per transaction
    '''
 
    payload = {'items':[]}
    acc_list = [src_info['address']]

    deposit_data = {}
    addr = src_info['address']
    deposit_len = len(deposit_list)
    m = random.randint(2000000000, 20000000000)
    nonce = 0

    #for index in range(deposit_len):
    deposit_temp = [deposit_list[j]['address'] for j in range(deposit_len)]
    if addr in deposit_temp:
        index = deposit_temp.index(addr)
        deposit_list[index]['nonce'] += 1
        nonce = deposit_list[index]['nonce']
        chain_list = deposit_list[index]['chain_info']
        chain_temp = [chain_list[i]['chain_id'] for i in range(len(chain_list))]
        if chainId in chain_temp:
            deposit_list[index]['chain_info'][chain_temp.index(chainId)]['amount'] += m
        else:
            deposit_list[index]['chain_info'].append({'chain_id':chainId,'amount':m})
    else:
        deposit_data['address'] = addr
        deposit_data['nonce'] = newNonce(addr)
        deposit_data['chain_info'] = [{'chain_id':chainId,'amount':m}]
        #deposit_list.append(deposit_data)
        nonce = deposit_data['nonce']
        
    if deposit_data['nonce'] == 0:
        print 'nonce is 0 return'
        return
    deposit_info = data_info(chainId, amount=m)
    addPayload(payload, 'deposit', acc_list, src_info, nonce, amount=m,args=deposit_info)
    success_count = sendRequest(payload)
    print 'deposit to '+ addr + ',amount='+str(m)+',chain_id='+str(chainId)+',success_count='+str(success_count)
    return


def withdrawal():
    ''' deposit 
    Args:
        numTx: total number of accounts to create
        numOpPerTx: number of accounts to create per transaction
    '''
    contract_address = CONTRACT_CPC_ADDRESS
    input_str = "{\"method\":\"queryChildDeposit\"}"
    payload = {'items':[]}
    global already_withdrawal_list
    recently_deposit = callContract_fun(contract_address,input_str)
    if recently_deposit['error_code'] != 0 or recently_deposit['result']['query_rets'][0].has_key('error'):
        print recently_deposit
        return
    
    deposit_msg = recently_deposit['result']['query_rets'][0]['result']['value']
    #deposit_msg.replace("\\","")
    recently_deposit_msg = json.loads(deposit_msg)
    if not recently_deposit_msg.has_key('deposit_data'):
        print recently_deposit_msg
        return
    deposit_address = recently_deposit_msg['deposit_data']['address']
    if already_withdrawal_list.has_key(deposit_address) and already_withdrawal_list[deposit_address] >= int(recently_deposit_msg['index']):
        return
    already_withdrawal_list[deposit_address] = int(recently_deposit_msg['index'])
#{"address":"buQXmJsPuZSstzMGXrVxswHoBgqiRcb6ajA5","amount":"1000"
    lines = []
    src_info = {}
    src_info['address'] = deposit_address
    with open(keypairs, 'r') as f:
        lines = f.readlines() 
    for line in lines:
        if json.loads(line.strip())['address'] == deposit_address:
            src_info['private_key'] = json.loads(line.strip())['private_key']
            break
 
    acc_list = [deposit_address]
    
    #m = random.randint(0, deposit_len)
    nonce = newNonce(deposit_address)
    #n = random.randint(0, len(deposit_list[m]['chain_info']))
    if nonce == 0:
        print 'withdrawal nonce is 0 return'
        return
    ran = random.randint(2000000000, 20000000000)
    #m = int(recently_deposit_msg['deposit_data']['amount'])
    withdrawal_info = data_info(chainID, amount=ran)
    addPayload(payload, 'withdrawal', acc_list, src_info, nonce, amount=0,args=withdrawal_info)
    success_count = sendRequest(payload)
    print 'withdrawal to '+ deposit_address + ',chain_id='+str(chainID)+',success_count='+str(success_count)
    #print 'success_count:' + success_count
    if success_count == 1:
        already_withdrawal_list[deposit_address] = int(recently_deposit_msg['index'])
    return

def withdrawal_client():
    ''' deposit 
    Args:
        numTx: total number of accounts to create
        numOpPerTx: number of accounts to create per transaction
    '''
    contract_address = CONTRACT_CPC_ADDRESS
    #
    #input_str = "{\"method\":\"queryChildWithdrawal\"}"
    #url = 'http://127.0.0.1:'
    urls = ['http://127.0.0.1:36102/','http://127.0.0.1:36202/','http://127.0.0.1:36302/']
    global already_withdrawal_list
    for i in range(len(urls)):
        child_seq = 1
        main_witndrawal_str = "{\"method\":\"queryChildWithdrawal\",\"params\":{\"chain_id\":\"%s\",\"seq\":\"\"}}" % bytes(i+1)
        main_withdrawal_ret = callContract_fun(CONTRACT_CMC_ADDRESS,main_witndrawal_str)
        if not main_withdrawal_ret  :
            continue
        if not main_withdrawal_ret['result']['query_rets'][0].has_key('error'):
            main_withdrawal_ret_json = json.loads(main_withdrawal_ret['result']['query_rets'][0]['result']['value'])
            child_seq = int(main_withdrawal_ret_json['seq']) + 1
        child_url = urls[i]
        
        input_str = "{\"method\":\"queryChildWithdrawal\",\"params\":{\"seq\":\"%d\"}}" % child_seq
        recently_withdrawal_ret = callContract_fun(contract_address,input_str,child_url)
        if not recently_withdrawal_ret or recently_withdrawal_ret['result']['query_rets'][0].has_key('error') :
            continue

        withdrawal_msg = recently_withdrawal_ret['result']['query_rets'][0]['result']['value']
        #withdrawal_msg.replace("\\","")
        recently_withdrawal = json.loads(withdrawal_msg)
        if already_withdrawal_list.has_key(child_url) and already_withdrawal_list[child_url] >= int(recently_withdrawal['seq']):
            continue
        already_withdrawal_list[child_url] = int(recently_withdrawal['seq'])
        withdrawal_address = recently_withdrawal['source_address']
    
        lines = []
        address_list = []
        src_info = {}
        payload = {'items':[]}
        src_info['address'] = withdrawal_address
        with open(keypairs, 'r') as f:
            lines = f.readlines() 
        for line in lines:
            if json.loads(line.strip())['address'] == withdrawal_address:
                src_info['private_key'] = json.loads(line.strip())['private_key']
                break
    
        acc_list = [withdrawal_address]
        
        nonce = newNonce(withdrawal_address)

        if nonce == 0:
            print 'withdrawal_client nonce is 0 return'
            return

        withdrawal_info = data_info(int(recently_withdrawal['chain_id']),"", int(recently_withdrawal['amount']),int(recently_withdrawal['block_seq']),int(recently_withdrawal['seq']))
        addPayload(payload, 'withdrawal_client', acc_list, src_info, nonce, amount=0,args=withdrawal_info)
        
        success_count = sendRequest(payload)
        print 'withdrawal_client to '+ withdrawal_address + ',chain_id='+str(recently_withdrawal['chain_id'])+',success_count='+str(success_count)
 
    return

def getTps(startSeq=0, endSeq=0):
    ''' Get performance of tx per second
    Args:
        startSeq: start ledger sequence
        endSeq: end ledger sequence
    '''
    
    # get time span from startSeq to endSeq
    if endSeq == 0:
        res = req('getLedger', {})
        if res['error_code'] == 0:
            end_time = res['result']['header']['close_time']
            if 'tx_count' not in res['result']['header'].keys():
                end_num = 0
            else:
                end_num = res['result']['header']['tx_count']
            endSeq = res['result']['header']['seq']
        else:
            print res
            return
    else:
        res = req('getLedger', {'seq':endSeq})
        if res['error_code'] == 0:
            end_time = res['result']['header']['close_time']
            if 'tx_count' not in res['result']['header'].keys():
                end_num = 0
            else:
                end_num = res['result']['header']['tx_count']
        else:
            print 'Block %s, %s' % (endSeq, res) 
            return

    if startSeq == 0:
        startSeq = endSeq - 1
    elif startSeq == 1:
        startSeq = 2
    res = req('getLedger', {'seq':startSeq})
    if res['error_code'] == 0:
        start_time = res['result']['header']['close_time']
        if 'tx_count' not in res['result']['header'].keys():
            start_num = 0
        else:
            start_num = res['result']['header']['tx_count']
    else:
        print 'Block %s, %s' % (startSeq, res) 
        return 
    
    tx_count = end_num - start_num
    time_span = float((end_time - start_time)) / 1000000
    print 'Block %s-%s, %s txs take %.2f second, tps is: %.2f' % (startSeq, endSeq, tx_count, time_span, tx_count / time_span) 
    return tx_count, time_span

def dumpLedgerView(span, startSeq=2):
    ''' Dump the close time and tx count of every block '''
    
    res = req('getLedger', {})
    if res['error_code'] == 0:
        endSeq = res['result']['header']['seq']
    if span == 0:
        span = 8640
    idx = startSeq + span
    lines = []
    while(idx < endSeq and startSeq < endSeq):
        tc, ts = getTps(startSeq, idx)
        startSeq += span 
        idx += span
        lines.append('%s %.2f\n' % (tc, ts))
    
    tc, ts = getTps(startSeq, endSeq)
    lines.append('%s %.2f\n' % (tc, ts))
    with open('./data.log', 'w') as f:
        f.writelines(lines)

if __name__ == "__main__":
    #test_deposit_withdrawal(1)
    try:
        opts, args = getopt.getopt(sys.argv[1:], "hc:p:P:n:o:s:u:f:l:m:")
    except getopt.GetoptError as msg:
        print msg
        sys.exit(1)
    
    get_cmds = [
        'getAccount',
        'getAccountBase',
        'getGenesisAccount',
        'getAccountMetaData',
        'getAccountAssets',
        'getTransactionBlob',
        'getTransactionHistory',
        'getTransactionCache',
        'getContractTx',
        'getStatus',
        'getLedger',
        'getModulesStatus',
        'getConsensusInfo',
        'getAddress',
        'getTransactionFromBlob',
        'getPeerNodeAddress',
        'getLedgerValidators',
        'getPeerAddresses'
    ]

    cmd = ''
    para = ''
    url = ''
    candidates_list = ''
    post = False
    test = False
    apply_fnode = False
    numberN = 0
    numberO = 0
    start_nonce = 0

    for op, arg in opts:
        if op == '-h':
            usage()
        elif op == '-c':
            cmd = arg
        elif op == '-P':
            post = True
        elif op == '-p':
            para = arg
        elif op == '-n':
            numberN = int(arg)
        elif op == '-m':
            chainid = int(arg)
        elif op == '-o':
            numberO = int(arg)
        elif op == '-s':
            start_nonce = int(arg)
        elif op == '-u':
            url = arg.strip('/') + '/'
            base_url = 'http://' + url
        elif op == '-f':
            keypairs = arg
        elif op == '-l':
            candidates_list = arg
        else:
            print 'Unknown options %s' % op
            sys.exit(1)
    
    get_request = lambda module, payload={}: json.dumps(requests.get(base_url + module, params=payload).json(), indent=4)
    post_request = lambda module, payload={}: json.dumps(requests.post(base_url + module, data=payload).json(), indent=4)

    if cmd == 'testElection':
        if candidates_list:
            with open(candidates_list, 'r') as f:
                for l in f:
                    keypair = json.loads(l.strip())
                    validator_dict[keypair['address']] = keypair['private_key']
        testElection(validator_dict)
    elif cmd == 'testElectionConfig':
        testElectionConfig(numberN or 1)
    elif cmd == 'testAbolish':
        testAbolish(numberN or 1)
    elif cmd == 'testDauReward':
        testDauReward(numberN or 10)
    elif cmd == 'list':
        listCommands()
    elif cmd == 'genKeyPairs':
        genKeyPairs(numberN)
    elif cmd == 'testPayCoin':
        testPayCoin(numberN, numberO, start_nonce)
    elif cmd == 'testCreateAccount':
        testCreateAccount(numberN, numberO)
    elif cmd == 'testIssueAsset':
        testIssueAsset(numberN, numberO, start_nonce)
    elif cmd == 'getTps':
        getTps(numberN, numberO)
    elif cmd == 'dumpLedgerView':
        dumpLedgerView(numberN, numberO)
    elif cmd == 'callContract':
        callContract()
    elif cmd == 'test_deposit_withdrawal':
        test_deposit_withdrawal(chainid)
    elif cmd:
        if cmd == 'th':
            cmd = 'getTransactionHistory'
        para_json = {}
        if para:
            if '{' in para:
                try:
                    para_json = json.loads(para)
                except ValueError as msg:
                    print 'Failed to parse json string, %s' % msg
                    sys.exit(1)
            elif '=' in para:
                for i in para.split(','):
                    para_json[i.split('=')[0]] = i.split('=')[1]
        if post:
            print post_request(cmd, para_json)
        else:
            print get_request(cmd, para_json)
    else:
        print 'No command given'
        sys.exit(1)
