# dpos接口详细

[English](dpos.md) | 中文

<!-- TOC -->

- [验证者节点选举](#验证者节点选举)
  - [创建选举合约账户](#创建选举合约账户)
  - [申请类型](#申请类型)
  - [申请成为候选节点](#申请成为候选节点)
  - [为候选节点投票和取消投票](#为候选节点投票和取消投票)
  - [申请退出](#申请退出)
  - [收回押金](#收回押金)
  - [废止恶意验证节点提案](#废止恶意验证节点提案)
  - [撤销废止恶意验证节点提案](#撤销废止恶意验证节点提案)
  - [对废止恶意验证节点提案投票](#对废止恶意验证节点提案投票)
  - [查询功能](#查询功能)
    - [查询当前验证节点集合](#查询当前验证节点集合)
    - [查询候选节点集合信息](#查询候选节点集合信息)
    - [查询用户投票信息](#查询用户投票信息)
    - [查询指定的废止恶意节点提案的信息](#查询指定的废止恶意节点提案的信息)
- [委员会](#委员会)
  - [委员会成员初始化设置](#委员会成员初始化设置)
  - [委员会选举](#委员会选举)
    - [委员会新成员提名](#委员会新成员提名)
    - [委员会成员退出](#委员会成员退出)
    - [委员会成员申请](#委员会成员申请)
  - [委员会查询](#委员会查询)
  - [验证节点选举配置更新](#验证节点选举配置更新)
    - [选举配置结构](#选举配置结构)
    - [选举配置更新提案](#选举配置更新提案)
    - [选举配置更新投票](#选举配置更新投票)
    - [查询选举配置信息](#查询选举配置信息)
      - [获取当前验证节点选举配置信息](#获取当前验证节点选举配置信息)
      - [获取验证节点选举配置提案信息](#获取验证节点选举配置提案信息)
      - [获取验证节点选举配置投票信息](#获取验证节点选举配置投票信息)
- [社区激励](#社区激励)
  - [KOL申请](#KOL申请)
  - [KOL退出](#KOL退出)
  - [KOL投票](#KOL投票)
  - [查询当前KOL信息](#查询当前KOL信息)
  - [收益模型](#收益模型)

<!-- /TOC -->

## 验证者节点选举

### 创建选举合约账户

DPOS合约账户创建成功后，才可以进行后续的操作，且该账户是全局唯一的, 不能重复创建。

- 创建一个合约账户（参见开发文档[创建账号](#创建账号)），账户的地址必须是buQqzdS9YSnokDjvzg4YaNatcFQfkgXqk6ss。由于选举合约存在更新，Bumo v2.0.0.0之后的版本自动使用新合约地址，老合约地址(buQtxgoaDrVJGtoPT66YnA2S84yE8FbBqQDJ)将废弃不用。
- 为方便升级，入口合约（假设为合约A）使用delegateCall方式将逻辑调用委托给另一个合约（假设为合约B）执行，delegateCall可以指定合约B的地址，故而可以通过更新合约地址的方式实现合约升级。合约地址由[委员会](#委员会)投票决定是否更新。
- 将 src\ledger\dpos.js 文件中的源码全部拷贝作为账户中 payload 字段的值。

>例

```json
     "contract" :
     {
       "payload" : "拷贝 src\ledger\dpos.js 中全部代码至此处"
     },
```

 在 dpos.js 文件指定的合约代码中, 以下变量可根据需要修改。但一旦DPOS合约创建成功，则不能再修改。

 ```json
  const approvePassRate       = 0.5;
  const electionPassRate      = 0.7;
  const effectiveVoteInterval = 15 * 24 * 60 * 60 * 1000 * 1000;
```

 - approvePassRate 委员会审核投票通过率，投票数 > 0.5 则投票通过，例如，假设总共有4个节点，4 * 0.5 = 2, 投票数 > 2，那么至少要有3个投票才能通过。
 - electionPassRate 投票通过率，投票数 >= 四舍五入( 节点总数 * electionPassRate ) 则投票通过，例如，假设总共有 4 个节点，那么 4 * 0.7 = 2.8，四舍五入后为 3，那么投票数必须 >= 3 才能通过, 如果总共有 6 个节点，那么 6 * 0.7 = 4.2，四舍五入后为 4，投票数必须 >= 4 才能通过，废止验证节点投票和选举配置更新都采用此通过率;
 - effectiveVoteInterval 有效期，单位为微秒，应用在投票有效期以及退出锁定期；

### 申请类型
任意 BuChain 账户可以申请成为委员会委员或候选KOL(Key Opinion Leader)，拥有节点的账户还可以申请成为候选节点，所以，对BuChain账户来说，有以下可申请的类型。
```
let applyType = {
  committee:1,
  validator:2,
  KOL:3
};
```
### 申请成为候选节点

任意一个拥有网络节点的账户可以通过向DPOS合约转移一笔 coin 作为押金，申请成为候选节点。经委员会投票审核通过后，可成为正式的候选节点。但能否成为验证节点，是根据一定周期内获得的总票数决定的。

- 申请者向DPOS合约转移一笔 coin 作为押金（参见开发文档‘[转移BU资产](#转移bu资产)’），该押金可通过 ‘[收回押金](#收回押金)’ 操作收回。
- ‘转移货币’操作的 input 字段填入`{ "method" : "apply", "params":{"type":2}}`,注意使用转义字符。
- 候选节点可以多次质押，增加质押金额，提高自己的排名。

>例

```json
  "pay_coin" :
  {
    "dest_address" : "buQqzdS9YSnokDjvzg4YaNatcFQfkgXqk6ss",
    "amount" :10000000000000,
    "input":
    "{
      \"method\":\"apply\",
      \"params\":
      {
        \"type\":2
      }
    }"
  }
```

申请成功后可以通过[查询功能](#查询功能)，查询候选节点信息。

注意：申请成为候选节点的账户必须拥有节点，且节点地址和账户地址相同。

### 为候选节点投票和取消投票

- 任意用户向DPOS合约转账一笔BU，转账额视为用户的投票数，在转账参数中提供的地址，视为投票支持的候选节点。
- 候选节点的得票总数为自身质押额与得票数之和，候选节点增加质押额相当于给自己投票。
- 用户可以为多个候选地址投票，可投票的候选节点个数，取决于候选节点集合大小和用户的账户余额。
- 对同一地址重复投票，后值将覆盖前值。后值大，则视为增加投票，后值小，则视为减少投票，地址参数不能省略。
- 如果投票额为0，视为用户撤销对该候选节点的投票，地址参数不能省略。
- ‘转移货币’操作的 input 字段填入` { "method" : "vote", "params" : { "type":"2", "address" : "填入候选节点地址"} }`，注意使用转义字符。

>例：对指定候选节点投票

```json
  "pay_coin" :
  {
    "dest_address" : "buQqzdS9YSnokDjvzg4YaNatcFQfkgXqk6ss",
    "amount" :100000000000, /*投票1000BU*/
    "input":
    "{
        \"method\":\"vote\",
        \"params\":
        {
          \"type\":2,
          \"address\":\"buQtZrMdBQqYzfxvqKX3M8qLZD3LNAuoSKj4\",
        }
    }"
  }
```

>例：对指定候选节点减少投票（承接前例）

```json
  "pay_coin" :
  {
    "dest_address" : "buQqzdS9YSnokDjvzg4YaNatcFQfkgXqk6ss",
    "amount" :50000000000, /*减少500BU投票*/
    "input":
    "{
        \"method\":\"vote\",
        \"params\":
        {
          \"type\":2,
          \"address\":\"buQtZrMdBQqYzfxvqKX3M8qLZD3LNAuoSKj4\",
        }
    }"
  }
```

>例：对指定候选节点取消投票（承接前例）

```json
  "pay_coin" :
  {
    "dest_address" : "buQqzdS9YSnokDjvzg4YaNatcFQfkgXqk6ss",
    "amount" :0,
    "input":
    "{
        \"method\":\"vote\",
        \"params\":
        {
          \"type\":2,
          \"address\":\"buQtZrMdBQqYzfxvqKX3M8qLZD3LNAuoSKj4\",
        }
    }"
  }
```

投票信息记录在合约中，可以通过获取投票信息接口getVoteInfo查询

>例

```json
  "pay_coin" :
  {
    "dest_address" : "buQqzdS9YSnokDjvzg4YaNatcFQfkgXqk6ss",
    "amount" :0,
    "input":
    "{
        \"method\":\"voteForCandidate\",
        \"params\":
        {
          \"address\":\"buQtZrMdBQqYzfxvqKX3M8qLZD3LNAuoSKj4\",
          \"reduceVotes\":\"100000000000\"
        }
    }"
  }
```

- 如果用户在已经支持了其他候选节点的情况下发起投票支持操作，将视为更改支持的候选节点。更改支持的候选节点时，对应的票数会先从原候选节点转移到新候选节点；然后再执行增加/减少投票流程，即更新用户投票金额和对应候选节点的得票数。

注意：减少投票的coin数额不得超过已有的投票金额。减少投票时转移coin应设置为0。

### 申请退出

- 候选节点可通过此操作收回全部押金。退出流程分两步：
  - 第一步是申请退出，申请成功后进入退出锁定期，锁定期为15天。
  - 锁定期结束后进入第二步，可以再次发送退出申请，此时锁定期已过，选举账户会将所有押金退回原账户，如果当前节点是验证节点，将触发验证节点集合更新。

- 向DPOS合约转移任意一笔资产或者一笔数额为 0 的 coin。
- ‘转移资产’或‘转移货币’操作的 input 字段填入 { "method":"withdrawCandidate" }，注意使用转义字符。

>例

```json
  "pay_coin" :
  {
    "dest_address" : "buQqzdS9YSnokDjvzg4YaNatcFQfkgXqk6ss",
    "amount" :0,
    "input":"{\"method\":\"withdrawCandidate\"}"
  }
```

### 收回押金

候选节点可通过此操作收回部分押金，当候选节点押金数额超过最低质押金额时，候选节点可从质押金中收回一部分。

- 向DPOS合约转移任意一笔资产或者一笔数额为 0 的 coin。
- ‘转移资产’或‘转移货币’操作的 input 字段填入 { "method":"takebackCandidatePledge", "amount": "1000000000000"}，注意使用转义字符。

>例

```json
  "pay_coin" :
  {
    "dest_address" : "buQqzdS9YSnokDjvzg4YaNatcFQfkgXqk6ss",
    "amount" :0,
    "input":"{\"method\":\"takebackCandidatePledge\", \"amount\": \"1000000000000\"}"
  }
```

操作成功后，选举账户会将数额为amount值的押金退回原账户，收回部分押金后，剩余押金不得低于最低质押金额。

### 废止恶意验证节点提案

如果某验证节点发现有另一个验证节点为恶意节点，或者不再适合作为验证节点，可以申请废止该恶意节点。发起‘废止恶意节点’提案后，需要所有验证节点投票决定是否执行废止操作。

- 废止者向DPOS合约转移任意一笔资产或者一笔数额为 0 的 coin。
- ‘转移资产’或‘转移货币’操作的 input 字段填入 { "method" : "abolishValidator",  "params" : { "address" : "此处填入恶意验证节点地址", "proof" : "此处填入废止该验证节点的原因"} }，注意使用转义字符。

>例

```json
  "pay_coin" :
  {
    "dest_address" : "buQqzdS9YSnokDjvzg4YaNatcFQfkgXqk6ss",
    "amount" :0,
    "input":
    "{
      \"method\":\"abolishValidator\",
      \"params\":
      {
        \"address\":\"buQmvKW11Xy1GL9RUXJKrydWuNykfaQr9SKE\"，
        \"proof\":\"I_saw_it_uncomfotable.\"
      }
    }"
  }
```

注意：申请废止者和被废止者必须都是验证者节点。

### 撤销废止恶意验证节点提案

如果发起废止操作的验证节点后来发现被废止节点并非恶意节点，可以取消废止操作。但如果该废止操作已经被其他验证节点投票通过，则无法取消。

- 废止者向DPOS合约转移任意一笔资产或者一笔数额为 0 的 coin。
- ‘转移资产’或‘转移货币’操作的 input 字段填入 { "method" : "quitAbolish",  "params" : { "address" : "此处填入恶意验证节点地址" } }。

>例

```json
  "pay_coin" :
  {
    "dest_address" : "buQqzdS9YSnokDjvzg4YaNatcFQfkgXqk6ss",
    "amount" :0,
    "input":
    "{ 
      \"method\":\"quitAbolish\",
      \"params\":
      { 
        \"address\":\"buQmvKW11Xy1GL9RUXJKrydWuNykfaQr9SKE\"
      }
    }"
  }
```

注意：只有申请废止者才可以取消，其他节点和验证者节点无权取消。

### 对废止恶意验证节点提案投票

投票通过后，恶意节点将被废止。恶意节点被废止后，恶意节点的押金将被罚没，且平均分给剩余的验证节点作为押金, 取模的余数奖励给票数最高的验证节点。

- 验证节点向选举账户转移任意一笔资产或者一笔数额为 0 的 coin。
- ‘转移资产’或‘转移货币’操作的 input 字段填入 { "method" : "voteForAbolish", "params" : { "address" : "此处填入被投票的恶意验证节点地址" } }，注意使用转义字符。

>例

```json
  "pay_coin" :
  {
    "dest_address" : "buQqzdS9YSnokDjvzg4YaNatcFQfkgXqk6ss",
    "amount" :0,
    "input":
    "{
       \"method\":\"voteForAbolish\",
      \"params\":
      {
         \"address\":\"buQmvKW11Xy1GL9RUXJKrydWuNykfaQr9SKE\"
      }
    }"
  }
```

注意：只有验证节点拥有投票权。若有效期内该废止提案未投票通过，则提案作废，申请被废止的节点将继续作为验证节点参与共识。

### 查询功能

用户通过向查询接口（即 query 接口）提供指定参数，可以查看相关信息, 调用查询接口当前只能通过 callContract, contract_address 字段填入验证者候选节点选举账户地址。

#### 查询当前验证节点集合

>例

```json
  {
    "contract_address" : "buQqzdS9YSnokDjvzg4YaNatcFQfkgXqk6ss",
    "code" : "",
    "input" : "{\"method\": \"getValidators\"}",
    "opt_type" : 2,
    "source_address" : ""
  }
```

#### 查询候选节点集合信息

>例

```json
  {
    "contract_address" : "buQqzdS9YSnokDjvzg4YaNatcFQfkgXqk6ss",
    "code" : "",
    "input" : "{\"method\": \"getCandidates\"}",
    "opt_type" : 2,
    "source_address" : ""
  }
```

#### 查询用户投票信息

>例

```json
  {
    "contract_address" : "buQqzdS9YSnokDjvzg4YaNatcFQfkgXqk6ss",
    "code" : "",
    "input" :
    "{
      \"method\": \"getVoterInfo\",
      \"params\":
      {
         \"address\":\"buQrVDKPCVE6LfCf8TyZEaiZ8R99NrSn4Fuz\"
      }
    }",
    "opt_type" : 2,
    "source_address" : ""
  }
```

#### 查询指定的废止恶意节点提案的信息

input 中的 address 字段填入指定的恶意节点地址。

>例

```json
  {
    "contract_address" : "buQqzdS9YSnokDjvzg4YaNatcFQfkgXqk6ss",
    "code" : "",
    "input" :
    "{
      \"method\": \"getAbolishProposal\",
      \"params\":
      {
         \"address\":\"buQmvKW11Xy1GL9RUXJKrydWuNykfaQr9SKE\"
      }
    }",
    "opt_type" : 2,
    "source_address" : ""
  }
```

## 委员会

委员会是独立于候选节点和验证节点之外的决策层，不参与奖励分配，没有利益驱动，成员主要来自于基金会和核心开发者，选举和创建时指定一个委员会集合，之后新成员的加入和退出需要其他委员会成员的投票决定。

目前主要功能有：

- 选举配置更新，如果有委员成员觉得当前选举配置不合理，可以提出选举配置更新提案，在有效期内委员会成员投票通过之后，下一轮区块打包时则使用新的选举配置。
- 候选节点审核，普通节点申请成为候选节点时，由委员会成员审核其是否具备成为候选节点的条件，包括物理节点配置，个人或者组织认证信息，信用程度等。
- KOL成员的审核，普通用户申请成为KOL时，由委员会审核其是否具备成为KOL的条件，包括公众影响力，社区贡献，以及个人或者组织认证信息，信用程度等。

### 委员会成员初始化设置

委员会成员初始化操作在合约创建时在入口函数init()中完成。
初始化之前需要将委员会成员在社区公示，以接受用户的监督，提高公信力。

### 委员会选举

#### 委员会新成员提名

- 委员会成员可以向DPOS合约转移任意一笔资产或者一笔数额为 0 的 coin，提名新的委员。成为新得委员需获得委员会2/3以上的成员同意。
- ‘转移货币’操作的 input 字段填入 { "method" : "nominateCommittee"}，注意使用转义字符。

>例

```json
  "pay_coin" :
  {
    "dest_address" : "buQqzdS9YSnokDjvzg4YaNatcFQfkgXqk6ss",
    "amount" :0,
    "input":
    "{\"method\":\"nominateNewMember\"}"
  }
```

申请成功后可以通过[查询当前委员会信息](#查询当前委员会信息)，查询候选节点信息。

注意：申请成为候选节点的账户必须拥有节点，且节点地址和账户地址相同。

#### 委员会成员退出

- 向DPOS合约转移任意一笔资产或者一笔数额为 0 的 coin。
- ‘转移资产’或‘转移货币’操作的 input 字段填入 { "method":"withdrawCommittee" }，注意使用转义字符。

>例

```json
  "pay_coin" :
  {
    "dest_address" : "buQqzdS9YSnokDjvzg4YaNatcFQfkgXqk6ss",
    "amount" :0,
    "input":"{\"method\":\"withdrawCommittee\"}"
  }
```

### 委员会新成员批准投票

- 所有用户均可向DPOS合约转移一笔coin投票支持某个KOL。
- ‘转移货币’操作的 input 字段填入 { "method":"voteForNewMember"}，注意使用转义字符。

>例

```json
  "pay_coin" :
  {
    "dest_address" : "buQqzdS9YSnokDjvzg4YaNatcFQfkgXqk6ss",
    "amount" :0,
    "input":"{\"method\":\"voteForNewMember\"}"
  }
```

操作成功后，选举账户会将数额为amount值的押金退回原账户，收回部分押金后，剩余押金不得低于最低质押金额。

### 查询当前委员会信息

用户通过向查询接口（即 query 接口）提供指定参数，可以查看相关信息, 调用查询接口当前只能通过 callContract, contract_address 字段填入验证者节点选举账户地址。

>例

```json
  {
    "contract_address" : "buQqzdS9YSnokDjvzg4YaNatcFQfkgXqk6ss",
    "code" : "",
    "input" : "{\"method\": \"getCommittee\"}",
    "opt_type" : 2,
    "source_address" : ""
  }
```

### 验证节点选举配置更新

- DPOS合约不仅支持选举功能，也支持选举配置的更新，选举配置更新分两个阶段，第一阶段由委员会对新的配置形成决议，第二阶段由验证节点集合对委员会配置更新决议进行确认。在有效期内确认完成后，将触发选举配置的更新，从下一区块开始采用新的配置。

#### 选举配置结构

```json
message ElectionConfig
{
  int64 candidate_pledge_amount = 1;
  int64 kol_pledge_amount = 2;
  int64 validators_refresh_interval = 3;
  int64 min_vote_coin = 4;
  string block_reward_share = 5;
  string fee_allocation_share = 6;
}
```

|   参数  |    说明          | 默认值                                         |
| :----- | ------------------ | -------------------------------------------- |
| candidate_pledge_amount     | 候选节点最低质押金额              | 500000000000000|
| kol_pledge_amount           | KOL最低质押金额                  | 1000000000000  |
| validators_refresh_interval | 验证节点集刷新时间（单位/秒，应>=10s) | 86400      |
| min_vote_coin               | 最小投票金额（单位MO，应>=100000000)| 100000000   |
| block_reward_share          | 区块奖励分配比例（验证节点：候选节点：KOL，比例之和为100)|"70:20:10"|
| fee_allocation_share        | 交易费分配比例（DAPP：区块奖励：创建者，比例之和为100)|"70:20:10"|

#### 选举配置更新提案

- 委员会成员向DPOS合约转移任意一笔资产或者一笔数额为 0 的 coin。
- 候选节点可以提议更新某一个参数，也可以同时更新多个参数，只需要在配置中填入需要更新的参数即可。
- ‘转移资产’或‘转移货币’操作的 input 字段填入 { "method" : "proposalCfg",  "params" : { "configuration" : {"kol_pledge_amount": "此处填入KOL最低质押金额"} }，注意使用转义字符。

>例

```json
  "pay_coin" :
  {
    "dest_address" : "buQqzdS9YSnokDjvzg4YaNatcFQfkgXqk6ss",
    "amount" :0,
    "input":
    "{
      \"method\":\"proposalCfg\",
      \"params\":
      {
        \"configuration\":
        {
            \"kol_pledge_amount\": 2000000000000,
            \"validators_refresh_interval\":172800 ,
            \"candidate_pledge_amount\": 100000000000000
        }
      }
    }"
  }
```

有效期内，委员会通过提案后，会产生一个验证节点复审提案，结构如下：

```json
{
  "validatorReviewProposal":
  "configuration":
  {
      "kol_pledge_amount": 2000000000000,
      "validators_refresh_interval":172800 ,
      "candidate_pledge_amount": 100000000000000
  }
}
```

#### 选举配置更新投票

- 验证节点向选举账户转移任意一笔资产或者一笔数额为 0 的 coin。
- ‘转移资产’或‘转移货币’操作的 input 字段填入 { "method" : "voteCfg", "params" : { "proposalId" : "此处填入选举配置更新提案ID" } }，注意使用转义字符。

>例

```json
  "pay_coin" :
  {
    "dest_address" : "buQqzdS9YSnokDjvzg4YaNatcFQfkgXqk6ss",
    "amount" :0,
    "input":
    "{
       \"method\":\"voteCfg\",
      \"params\":
      {
         \"proposalId\":\"buQmvKW11Xy1GL9RUXJKrydWuNykfaQr9SKE1\"
      }
    }"
  }
```

注意：只有候选节点拥有投票权。若有效期内该配置更新提案未投票通过，则提案作废，选举配置保持不变。

### 查询选举配置信息

用户通过向查询接口（即 query 接口）提供指定参数，可以查看相关信息, 调用查询接口当前只能通过 callContract, contract_address 字段填入验证者候选节点选举账户地址。

#### 获取当前验证节点选举配置信息

>例

```json
  {
    "contract_address" : "buQqzdS9YSnokDjvzg4YaNatcFQfkgXqk6ss",
    "code" : "",
    "input":"{\"method\": \"getConfiguration\"}",
    "opt_type" : 2,
    "source_address" : ""
  }
```

#### 获取验证节点选举配置提案信息

>例

```
  {
    "contract_address" : "buQqzdS9YSnokDjvzg4YaNatcFQfkgXqk6ss",
    "code" : "",
    "input" : "{\"method\": \"getConfigProposal\"}",
    "opt_type" : 2,
    "source_address" : ""
  }
```

#### 获取验证节点选举配置投票信息

input 中的 proposalId 字段填入指定的配置提案ID。

>例

```json
  {
    "contract_address" : "buQqzdS9YSnokDjvzg4YaNatcFQfkgXqk6ss",
    "code" : "",
    "input" :
    "{
      \"method\": \"getConfigVote\",
      \"params\":
      {
        \"proposalId\":\"buQmvKW11Xy1GL9RUXJKrydWuNykfaQr9SKE1\"
      }
    }",
    "opt_type" : 2,
    "source_address" : ""
  }
```

## 社区激励

公链生态的发展离不开社区的活跃，对Key Opinion Leader进行奖励是一个提升公链知名度，提升关注度，增加社区成员的办法。

### KOL申请

任意一个用户账户可以通过向DPOS合约转移一笔 coin 作为押金，申请成为KOL。但能否成为KOL，是根据一定周期内获得的用户投票总票数决定的。

- 申请者向DPOS合约转移一笔 coin 作为押金（参见开发文档‘[转移BU资产](#转移bu资产)’），该押金可通过 ‘[收回押金](#收回押金)’ 操作收回。
- ‘转移货币’操作的 input 字段填入 { "method" : "kolPledgeCoin"}，注意使用转义字符。

>例

```json
  "pay_coin" :
  {
    "dest_address" : "buQqzdS9YSnokDjvzg4YaNatcFQfkgXqk6ss",
    "amount" :1000000000000,
    "input":
    "{\"method\":\"kolPledgeCoin\"}"
  }
```

申请成功后可以通过[查询当前KOL信息](#查询当前KOL信息)，查询候选节点信息。

注意：申请成为候选节点的账户必须拥有节点，且节点地址和账户地址相同。

### KOL退出

- KOL可通过此操作收回全部押金。退出流程分两步：
  - 第一步是申请退出，申请成功后进入退出锁定期，锁定期为15天。
  - 锁定期结束后进入第二步，可以再次发送退出申请，此时锁定期已过，选举账户会将所有押金退回原账户，如果当前节点是KOL，将触发KOL集合更新。

- 向DPOS合约转移任意一笔资产或者一笔数额为 0 的 coin。
- ‘转移资产’或‘转移货币’操作的 input 字段填入 { "method":"withdrawKol" }，注意使用转义字符。

>例

```json
  "pay_coin" :
  {
    "dest_address" : "buQqzdS9YSnokDjvzg4YaNatcFQfkgXqk6ss",
    "amount" :0,
    "input":"{\"method\":\"withdrawKol\"}"
  }
```

### KOL投票

- 所有用户均可向DPOS合约转移一笔coin投票支持某个KOL。
- ‘转移货币’操作的 input 字段填入 { "method":"voteForKol", "amount": "1000000000000"}，注意使用转义字符。

>例

```json
  "pay_coin" :
  {
    "dest_address" : "buQqzdS9YSnokDjvzg4YaNatcFQfkgXqk6ss",
    "amount" :0,
    "input":"{\"method\":\"voteForKol\", \"amount\": \"1000000000000\"}"
  }
```

操作成功后，选举账户会将数额为amount值的押金退回原账户，收回部分押金后，剩余押金不得低于最低质押金额。

### 查询当前KOL信息

用户通过向查询接口（即 query 接口）提供指定参数，可以查看相关信息, 调用查询接口当前只能通过 callContract, contract_address 字段填入验证者节点选举账户地址。

>例

```json
  {
    "contract_address" : "buQqzdS9YSnokDjvzg4YaNatcFQfkgXqk6ss",
    "code" : "",
    "input" : "{\"method\": \"getKols\"}",
    "opt_type" : 2,
    "source_address" : ""
  }
```

### 收益模型

阿里云

- 8核，32G，900G本地ssd， 120G系统盘，16480/年
- 16核，64G，1788G本地ssd，120G系统盘，31525/年

以8核32G机器为例，当前币价约￥0.3（2019-1-13）：

- 一年总收益：8640* 8* 0.3* 365/天 = ￥7568640
- 30个验证节点：￥7568640* 0.7 / 30 = ￥176601.6，质押500w BU* 0.3 = ￥150w, ￥16w左右收益，平均年收益率约10.6%（日交易量100w左右，费用激励可忽略）
- 10个候选节点：￥7568640* 0.2 / 10 = ￥151372，质押500w BU* 0.3 = ￥150w, ￥13.5万左右收益，平均年收益率约8%（候选节点越多，收益越低，参选节点维持在40-50个较为合适）
- 50个KOL： ￥7568640* 10% = 756864 / 50 = ￥15137, 质押50w BU* 0.3 = ￥15w, ￥15137收益，平均年收益率约10%
- DAPP：100w tx* 0.0025* 0.3* 0.7 = 525， 100w交易获得￥525的返现。
