import { callRpc, setlog, now } from "../helper"

const colors = require('colors')

abstract class IScan {
	inited:boolean
	memPool:{[txid:string]:TxType}
    chain:string
    checkPool:boolean
    net: NetworkType
	actions:ActionType

    constructor(chain:string, checkPool:boolean, net:NetworkType, actions:ActionType) {
		this.inited = false
        this.chain = chain
		this.memPool = {}
        this.checkPool = checkPool
        this.net = net
		this.actions = actions
	}
	
	init() {
		if (this.checkPool) this.readPool()
		this.readBlock();
		console.log(colors.yellow(`started ${this.net.title}`))
	}
	abstract getLatestBlockNumber(): Promise<number>
	abstract getBlock(height:number): Promise<BlockType|null>
	abstract getMemPool(memPool:{[txid:string]:TxType}): Promise<Array<TxType>|null>
	abstract getTxsJson(txs:Array<string>):Array<JsonType>

	addToTxs(txs: Array<TX>, itx: TxType, lastHeight:number) {
		for (const i of itx.ins) {
			const height = i.height || itx.height
			const tx = {
				address:    	i.address,
				txid: 	    	i.txid,
				height,
				confirmations:  height ? lastHeight - height + 1 : 0,
				vout: 	   		i.vout,
				coin: 	    	i.coin || this.net.coin,
				amount:     	i.value,
				spenttx:    	itx.txid,
				created:    	i.created
			} as TX
			if (i.vout) tx.vout = i.vout
			if (itx.error) tx.error = true
			if (itx.rbf) tx.rbf = itx.rbf
			txs.push(tx)
		}
		for (const i of itx.outs) {
			const tx = {
				address:    	i.address,
				txid: 	    	itx.txid,
				height:     	itx.height,
				confirmations:  itx.height ? lastHeight - itx.height + 1 : 0,
				coin: 	    	i.coin || this.net.coin,
				amount:     	i.value,
				created:    	itx.blocktime
			} as TX
			if (i.vout) tx.vout = i.vout
			if (itx.error) tx.error = true
			if (itx.rbf) tx.rbf = itx.rbf
			txs.push(tx)
		}
	}
	async existTxs(json:Array<{jsonrpc:string, id:string|number, method:string, params:Array<string>}>):Promise<{[txid:string]:boolean}|null> {
		try {
			const txs = {} as {[txid:string]:boolean}
			if (json.length) {
				const rawTxs=await callRpc(this.chain, this.net, json);
				if(rawTxs && Array.isArray(rawTxs)) {
					for(let k = 0; k < rawTxs.length; k++) {
						txs[json[k].params[0]] = !!rawTxs[k].result
					}
				}
				return txs;
			}
		} catch (error:any) {
			setlog(this.chain, error)
		}
		return null
	}
	async readBlock() {
		try {
			let height = this.net.height + 1;
			let lastest = await this.getLatestBlockNumber()
			if (height===1) {
				height = lastest
			} else if (height>lastest + 1) {
				height = lastest + 1
			}
			if (this.net.scanPosition) {
				height = this.net.scanPosition
				delete this.net.scanPosition
			}
			
			// console.log(this.net.title + ' ' + colors.green(`#${height} / ${lastest}`))

			while ( height <= lastest ) {
				let time=+new Date();
				if (this.net.scanPosition) {
					height = this.net.scanPosition
					delete this.net.scanPosition
				}
				let block = await this.getBlock(height)
				if (block) {
					const txs = [] as Array<TX>
					const add = {} as {[txid:string]:TxType}
					const del = [] as Array<string>
					const json = Object.keys(this.net.pending)
					if (json.length) {
						const result = await this.existTxs(this.getTxsJson(json))
						if (result!==null) {
							for(let txid in result) {
								if (result[txid]) {
									this.addToTxs(txs, this.net.pending[txid], height)
									
									const confirmations = height - this.net.pending[txid].height + 1
									if (confirmations >= this.net.confirmations) {
										delete this.net.pending[txid]
										del.push(txid)
									}
								} else {
									this.addToTxs(txs, this.net.pending[txid], height)
									delete this.net.pending[txid]
									del.push(txid)
								}
							}
						}
					}
					for(let tx of block.txs) {
						if (tx) {
							if (tx.ins.length + tx.outs.length) {
								this.addToTxs(txs, tx, height)
								this.net.pending[tx.txid] = tx
								add[tx.txid] = tx
							}
						}
					}
					this.net.height = height
					if (Object.keys(add).length || del.length) await this.actions.pending(this.chain, add, del)
					if (txs.length) await this.actions.update(this.chain, height, txs, block.balances)
					await this.actions.event(this.chain, height, 0, block.txs.length, block.timestamp, +new Date() - time)
					
					height ++;
				}
				await new Promise(resolve=>setTimeout(resolve,1000));
			}
		} catch (error:any) {
			setlog(this.chain, error)
		}
		setTimeout(()=>this.readBlock(),this.net.scanPeriod || 10000);
	}
	async readPool() {
		let time=+new Date();
		try {
			const rows = await this.getMemPool(this.memPool)
			if (rows) {
				this.memPool = {}
				const txs = [] as Array<TX>
				for(let i of rows) {
					this.addToTxs(txs, i, 0)
					this.memPool[i.txid] = i
				}
				if (txs.length) await this.actions.update(this.chain, 0, txs)
				await this.actions.event(this.chain, 0, 0, rows.length, 0, +new Date()-time)
			}
		} catch (error:any) {
			setlog(this.chain, error)
		}
		setTimeout(()=>this.readPool(),3000);
	}
}

export default IScan