require("dotenv").config();
import {setlog, callRpc, now} from '../helper'
import IScan from './IScan';

class EvmScan extends IScan {
	override getTxsJson(txs: string[]): JsonType[] {
		return txs.map((i,k) => ({"jsonrpc":"2.0", "id":k, "method":"eth_getTransactionReceipt", "params":[i]}))
	}

	override async getLatestBlockNumber(): Promise<number> {
		const response = await callRpc(this.chain, this.net, {"jsonrpc":"2.0", "method":"eth_blockNumber", "params":[], "id":1});
		if (response) return Number(response.result)
		return 0
	}

	override async getBlock(height: number): Promise<BlockType | null> {
		let json = {"jsonrpc":"2.0", "method":"eth_getBlockByNumber", "params":['0x'+height.toString(16), true], "id":height}
		let res = await callRpc(this.chain, this.net, json);
		if (res && res.result) {
			const block = res.result
			const result = { timestamp:Number(block.timestamp), txs:[] } as BlockType
			const txs = block.transactions
			if (txs.length) {
				txs.map((i:any)=>result.txs.push(this.getTransactionFromRaw(i, height, result.timestamp)))
				result.balances = await this.checkingReceipt(result.txs)
			}
			return result
		}
		return null
	}
	
	override async getMemPool(memPool: { [txid: string]: TxType; }): Promise<TxType[]|null> {
		const response = await callRpc(this.chain, this.net, {"jsonrpc":"2.0", "method":"txpool_content", "params":[], "id":1});
		if (response && response.result && response.result.pending) {
			const {queued, pending} = response.result
			const txs = [] as Array<TxType>
			const timestamp = now()
			const txlist = [] as Array<TxType>
			for(let addr in pending) {
				for(let k in pending[addr]) {
					let hash=pending[addr][k].hash;
					if (memPool[hash]===undefined) txlist.push(hash);
				}
			}
			for(let addr in queued) {
				for(let k in queued[addr]) {
					let hash=queued[addr][k].hash;
					if (memPool[hash]===undefined) txlist.push(hash);
				}
			}
			txlist.map((i:any)=>txs.push(this.getTransactionFromRaw(i, 0, timestamp)))
			return txs
		}
		return null
	}

	private getTransactionFromRaw(tx:any,height:number,created:number):TxType {
		const result = {
			txid: tx.hash,
			height,
			blocktime: created,
			ins: [],
			outs: []
		} as TxType
		try {

			if(!tx.to) return result
			let coin = ''
			let value
			let from = tx.from.toLowerCase()
			let to = tx.to.toLowerCase()
			let contract;
			if (tx.input==='0x') {
				if(tx.value==='0x') {
					value=0
				}else{
					value = tx.value
				}
				
			} else {
				let c = this.net.tokens[to]
				if (c!==undefined) {
					const method = tx.input.slice(2,34)
					if (method==='a9059cbb000000000000000000000000') {
						contract = to
						coin = c.symbol
						to = '0x' + tx.input.slice(34, 74).toLowerCase()
						value = '0x' + BigInt('0x' + tx.input.slice(74)).toString(16)
						/* coin = c.symbol */
						// console.log('method', method, 'to', to, 'value', value)
					}
				}
			}
			const isFrom = this.net.addrs[from]
			const isTo = this.net.addrs[to]
			if (isFrom || isTo) {
				if (isFrom) {
					result.ins.push({
						coin,
						contract,
						address:from,
						value
					})
				}
				if (isTo) {
					result.outs.push({
						coin,
						contract,
						address:to,
						value
					})
				}
			}
		} catch (error:any) {
			setlog(error)
		}
		return result
	}

	private async checkingReceipt(txs: Array<TxType>):Promise<Array<BalanceType>> {
		const result = [] as Array<BalanceType>
		let json=[]
		for(let i=0; i<txs.length; i++) {
			if (txs[i].ins.length && txs[i].outs.length) {
				json.push({"jsonrpc":"2.0", "method":"eth_getTransactionReceipt", "params":[txs[i].txid], "id":i})
			}
		}
		if (json.length) {
			let res=await callRpc(this.chain, this.net, json)
			if(res) {
				const as = {} as {[address:string]:{[coin:string]:boolean}}
				for(let r of res) {
					const id = r.id as number
					if(r.result) {
						if (txs[id] && r.result.status!=='0x1') {
							txs[id].error = true
						}
						for(let i of txs[id].ins) {
							as[i.address] ??= {}
							if (i.contract) as[i.address][i.contract] = true
						}
						for(let i of txs[id].outs) {
							as[i.address] ??= {}
							if (i.contract) as[i.address][i.contract] = true
						}
					}
				}
				let json = []
				let ts = []
				let k=0
				for(let address in as) {
					ts.push(address+'-'+this.net.coin)
					json.push({"jsonrpc":"2.0", "method":"eth_getBalance", "params":[address,"latest"],"id":k++});
					for(let contract in as[address]) {
						ts.push(address+'-'+this.net.tokens[contract].symbol);
						json.push({"jsonrpc":"2.0","method":"eth_call","params":[{"to": contract, "data":"0x70a08231000000000000000000000000"+address.slice(2)}, "latest"],"id":k++});
					}
				}
				res = await callRpc(this.chain, this.net, json);
				if(res) {
					for (let v of res) {
						let [address, coin] = ts[v.id].split('-');
						if (v.result) {
							result.push({address, coin, balance:'0x' + BigInt(v.result).toString(16)})
						}
					}
				}
			}
		}
		return result
	}
	
}

export default EvmScan