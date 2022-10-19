require("dotenv").config();
import * as bitGoUTXO from '@bitgo/utxo-lib'
import {setlog, callRpc, now} from '../helper'
import IScan from './IScan';

const networks = {
    btc: bitGoUTXO.networks.bitcoin,
    btctest: bitGoUTXO.networks.testnet,
    ltc: bitGoUTXO.networks.litecoin,
    ltctest: bitGoUTXO.networks.litecoinTest,
} as {[key:string]:any}


class UtxoModel extends IScan {
	override getTxsJson(txs: string[]): JsonType[] {
		return txs.map((i,k) => ({ jsonrpc:"1.0",  id:k, method:"getrawtransaction", params:[i]}))
	}

	override async getLatestBlockNumber(): Promise<number> {
		let res = await callRpc(this.chain, this.net, {jsonrpc:"1.0", id: 1, method:"getblockcount", params:[]}); 
		if (res) return Number(res.result);
		return 0
	}
	
	override async getBlock(height:number): Promise<BlockType|null> {
		const hash = await this.getBlockHash(height)
		if (hash) {
			const response:any = await callRpc(this.chain, this.net, { jsonrpc:"1.0", id: 1, method:"getblock", params:[hash] });
			if (response && response.result) {
				const block = response.result
				const result = { timestamp: block.time,txs: [] } as BlockType
				const txlist = block.tx as string[]
				const len = txlist.length
				if (len) {
					let end = 0, start = 0, max = 100, timestamp = now()
					while(end<len) {
						end = start + max
						if (end > len) end = len
						let rs = txlist.slice(start, end)
						const raw=await callRpc(this.chain, this.net, rs.map((i,k) => ({ jsonrpc:"1.0", id:k, method:"getrawtransaction", params:[i] })));
						if(raw && Array.isArray(raw)) {
							for(let i of raw) {
								if (i.result) result.txs.push(this.getTransactionFromRaw(i.result, height, timestamp))
							}
						}
						start = end
					}
				}
				return result
			}
		}
		return null
	}
	
	override async getMemPool(memPool: { [txid: string]: TxType; }): Promise<TxType[]|null> {
		const response = await callRpc(this.chain, this.net, { jsonrpc:"1.0", id: 1, method:"getrawmempool", params:[] })
		if (response && response.result) {
			const len = response.result.length
			const txlist = response.result.filter((i:string)=>!memPool[i]) as Array<string>
			const txs = [] as Array<TxType>
			let end = 0, start = 0, max = 100, timestamp = now()
			while(end<len) {
				end = start + max
				if (end > len) end = len
				let rs = txlist.slice(start, end)
				const raw=await callRpc(this.chain, this.net, rs.map((i,k) => ({ jsonrpc:"1.0", id:k, method:"getrawtransaction", params:[i] })))
				if(raw && Array.isArray(raw)) {
					for(let i of raw) {
						if (i.result) txs.push(this.getTransactionFromRaw(i.result, 0, timestamp))
					}
				}
				start = end
			}
			return txs
		}
		return null
	}

	private async getBlockHash(height:number):Promise<string|null> {
		const response=await callRpc(this.chain, this.net, { jsonrpc:"1.0", id: 1, method:"getblockhash", params:[height] })
		if (response) return response.result
		return null
	}

	private getTransactionFromRaw(raw:string,height:number,created:number):TxType {
		let tx = bitGoUTXO.Transaction.fromHex(raw)
		let hash=tx.getId()
		const result = {
			txid: hash,
			height,
			blocktime: created,
			rbf:		false,
			ins: [],
			outs: []
		} as TxType
		/* if (hash==='a70c856c212645a124136dd19b799a0eafcb6610f58668220620ac2bc6a36fdd') {
			console.log("abcd")
		} */
		try {
			if (tx.ins && Array.isArray(tx.ins)) {
				for(let v of tx.ins) {
					let txid = Buffer.from(v.hash).reverse().toString('hex')
					let vout = v.index
					if (!result.rbf && v.sequence!==0xFFFFFFFF) result.rbf = true
					if (txid=='0000000000000000000000000000000000000000000000000000000000000000') continue
					let address = this.net.txs[txid+'-'+vout]
					if (address) {
						let ix = this.net.addrs[address].txs[txid+'-'+vout]
						if (ix) {
							result.ins.push({
								coin: this.net.coin,
								address,
								txid,
								height:		ix.height,
								vout: 	    vout,
								value:     ix.amount,
								created:	ix.created
							})
						}
					}
				}
			}
			if (tx.outs && Array.isArray(tx.outs)) {
				let vout=0
				for(let out of tx.outs) {
					try{
						if(out.value) {
							let address = bitGoUTXO.address.fromOutputScript(out.script, networks[this.chain])
							if (this.net.addrs[address]) {
								// console.log('deposit ' + this.chain + ' #' + height + ' ' + address + ' ' + out.value)
								result.outs.push({
									coin: this.net.coin,
									address, 
									value:String(out.value), 
									vout
								})
							}
						}
					}catch(err){
						// console.log(err)
					}
					vout++
				}
			}
		} catch (error:any) {
			setlog(error)
		}
		return result
	}
	
}

export default UtxoModel