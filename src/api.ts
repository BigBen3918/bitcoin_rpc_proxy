require("dotenv").config()
import * as express from 'express'

import axios from 'axios'

import { getNewId, getObjectId, Admins, Users, Blocks, Wallets, WalletTxType, Pending } from './Model'
import { setlog, callRpc } from './helper'
/* import { getSession, setSession } from './Redis' */
/* import * as abi from './config/abis/IRC20.json'
import { getSession } from './Redis' */
import UtxoScan from './chains/UtxoScan'
import { hmac256 } from './helper'
import { ObjectId } from 'mongodb'
import EvmScan from './chains/EvmScan'
const colors = require('colors')

const secret = process.env.APP_SECRET || ''
const router = express.Router()

const isDevelop = process.env.NODE_ENV==='development'
const dsJson = require('../.domains.' + (isDevelop ? 'dev' : 'prod') + '.json')
const chJson = require('../.chains.' + (isDevelop ? 'dev' : 'prod') + '.json') as {[chain:string]: NetworkConfig}
/* const config = chJson as {[chain:string]: NetworkConfig} */
const chains = {} as {[chain:string]: NetworkType}
/* const div = (a:string|number,b:string|number) => Number(BigInt(a)/BigInt(b)) */
/* const utils = new Web3().utils
const toHex = (val: string | number): string => utils.toHex(val) */
// const NULLADDRESS = '0x0000000000000000000000000000000000000000'



const now = () => Math.round(new Date().getTime()/1000)
/* const N = (a:number) => Math.floor(a * 1e6) / 1e6 */

for(let i in chJson) {
	if (chJson[i].blockTime) {
		chains[i] = {
			title: chJson[i].title,
			scan: !!chJson[i].scan,
			scanPeriod: chJson[i].scanPeriod,
			mempool: !!chJson[i].mempool,
			evm: !!chJson[i].evm,
			utxo: !!chJson[i].utxo,
			blockTime: chJson[i].blockTime,
			confirmations: chJson[i].confirmations,
			height: 0,
			rpcIndex: chJson[i].rpcIndex || 0,
			rpc: chJson[i].rpc,
			coin: chJson[i].coin,
			decimals: chJson[i].decimals,
			tokens: {},
			addrs: {},
			txs: {},
			pending: {}
		}
	}
}

const webhooks = {} as {[uid:string]:string} // webhooks
const domains = dsJson as {[domain:string]:string}
/* const x = (process.env.DOMAINS || '').split(',')
for(let i of x) {
	domains[i] = process.env[i] || ''
} */


export const actions = {
	async pending(chain, add, del) {
		if (Object.keys(add).length) {
			const $set = {} as {[key:string]: TxType}
			for (let i in add) {
				$set["txs." + i] = add[i]
			}
			const result = await Pending.updateOne({
				chain
			}, {
				$set
			}, {upsert:true})
			/* console.log(result) */
		}
		if (del.length) {
			const $unset = {} as any //{[txid:string]:string}
			for(let i of del) $unset["txs." + i] = ""
			const result = await Pending.updateOne({
				chain
			}, {
				$unset
			})
			/* console.log(result) */
		}
	},
	async update(chain, height, txs, addrs) {
		// const evm = !!chains[chain].evm
		const utxo = !!chains[chain].utxo
		const as = {} as {[address:string]:string}
		for(let i of txs) {
			const key = [i.txid, i.vout].join('-')
			as[i.address] ??= ""
			const addr = chains[chain].addrs[i.address]
			// console.log(`${i.spenttx?'spent':'deposit'} #${i.height} confirmations: ${i.confirmations}/${chains[chain].confirmations} [${i.address}] - ${i.coin} ${i.amount} ${new Date(i.created*1000)}`)
			if (i.spenttx) {
				if (utxo) {
					delete addr.txs[key]
					delete chains[chain].txs[key]
					if (i.height) {
						if (i.error) {
							await Wallets.updateOne({
								chain, address:i.address
							}, {
								$unset:{["txs."+key+'.spenttx']: ""}
							})
							addr.txs[key] = {
								txid:		i.txid,
								height: 	i.height,
								vout: 		i.vout || 0,
								rbf: 	    i.rbf || false,
								coin: 		i.coin,
								amount: 	i.amount,
								created:	i.created
							}
							chains[chain].txs[key] = i.address
						} else {
							await Wallets.updateOne({
								chain, address:i.address
							}, {
								$set:{["txs."+key+'.spenttx']: i.spenttx}
							})
						}
					}
				} else {
					if (i.height) {
						const data = {
							txid:		i.txid,
							height: 	i.height,
							coin: 		i.coin,
							amount: 	i.amount,
							spenttx:	i.spenttx,
							created:	i.created
						} as WalletTxType
						if (i.error) data.error = true
						const result = await Wallets.updateOne({
							chain, address:i.address
						}, {
							$set: {
								["txs."+key]: data
							}
						})
					}
				}
			} else {
				if (utxo){
					addr.txs[key] = {
						txid:		i.txid,
						height: 	i.height,
						vout: 		i.vout || 0,
						rbf: 	    i.rbf || false,
						coin: 		i.coin,
						amount: 	i.amount,
						created:	i.created
					}
					chains[chain].txs[key] = i.address
					
					if (i.height) {
						const result = await Wallets.updateOne({
							chain, address:i.address
						}, {
							$set: {
								["txs."+key]:{
									txid:		i.txid,
									height: 	i.height,
									vout: 		i.vout,
									rbf: 	    i.rbf,
									coin: 		i.coin,
									amount: 	i.amount,
									created:	i.created
								}
							}
						})
						/* console.log(result) */
					}
				} else {
					if (i.height) {
						const result = await Wallets.updateOne({
							chain, address:i.address
						}, {
							$set: {
								["txs."+key]:{
									txid:		i.txid,
									height: 	i.height,
									vout: 		i.vout,
									rbf: 	    i.rbf,
									coin: 		i.coin,
									amount: 	i.amount,
									error:    	!!i.error,
									spenttx:	i.spenttx,
									created:	i.created
								}
							}
						})
						/* console.log(result) */
					}
				}
			}
		}
		if (utxo) {
			for(let address in as) {
				const addr = chains[chain].addrs[address]
				const coin = chains[chain].coin
				for(let i in addr.txs) {
					as[address] = '0x' + (BigInt(as[address]) + BigInt(addr.txs[i].amount)).toString(16)
				}
				await Wallets.updateOne({
					chain, address
				}, {
					$set: {
						["balances."+coin]:as[address]
					}
				})
			}
		} else if (addrs) {
			for(let addr of addrs) {
				await Wallets.updateOne({
					chain, address:addr.address
				}, {
					$set: {
						["balances." + addr.coin]:addr.balance
					}
				})
			}
		}
		// call web hook
		const us = {} as {[uid:string]:TX[]}
		for(let i of txs) {
			const uid = chains[chain].addrs[i.address].uid
			us[uid] ??= []
			us[uid].push(i)
		}
		for(let i in us) {
			if (webhooks[i]) {
				await callWebhook(webhooks[i], {chain, txs:us[i]})
			}
		}
	},

	async event(chain, height, progress, total, blocktime, spent) {
		if (height) {
			await Blocks.updateOne({chain}, {$set:{chain, height}}, {upsert: true})
		}
		// console.log(`chain: ${chain} #${height===0 ? 'mempool' : height} (${progress} / ${total}) ${new Date(blocktime*1000).toLocaleString()} ${spent}ms`)
	}
} as ActionType

const callWebhook = async (url:string, json:any):Promise<boolean>=>{
	try {
		const response = await axios.post(url, json, {timeout: 60000, headers: {'Content-Type': 'application/json'}})
		if (response!==null && response.data) {
			// console.log(colors.yellow('webhook ') + colors.white(url) + ' ' + (response.data.result ? colors.green('success') : colors.red('fail')))
			if (response.data.result!==undefined) return true
		}

	} catch (error:any) {
		setlog(error)
	}
	return false
}

export const initApi = async () => {
	try {
		const blocks = await Blocks.find().toArray()
		if (blocks) blocks.map( block => chains[block.chain] && (chains[block.chain].height = block.height))
		const users = await Users.find().toArray()
		if (users) {
			for(let user of users) {
				const uid = user._id.toHexString()
				if (user.webhook) webhooks[uid] = user.webhook
				if (user.tokens.length) {
					for(let i of user.tokens) {
						if (chains[i.chain]) {
							const contract = chains[i.chain].evm ? i.contract.toLowerCase() : i.contract
							chains[i.chain].tokens[contract] = { symbol:i.symbol, decimals:i.decimals }
						}
					}
				}
			}
		}
		const pending = await Pending.find().toArray()
		if (pending.length) {
			for (let i of pending) {
				
				for (let key in i.txs) {
					const tx = i.txs[key]
					chains[i.chain] && (chains[i.chain].pending[key] = tx)
				}
			}
		}
		const wallets = await Wallets.find().toArray()
		if (wallets.length) {
			for (let i of wallets) {
				if (chains[i.chain]) {
					const address = chains[i.chain].evm ? i.address.toLowerCase() : i.address
					chains[i.chain].addrs[address] = {
						uid: i.uid.toHexString(),
						/* balances: i.balances, */
						txs: {}
					}
					for (let key in i.txs) {
						const tx = i.txs[key]
						if (!tx.spenttx) {
							const key = [tx.txid, tx.vout].join('-')
							chains[i.chain].addrs[address].txs[key] = {
								txid:		tx.txid,
								height:		tx.height,
								vout: 	    tx.vout || 0,
								rbf:		tx.rbf || false,
								coin: 	    tx.coin,
								amount:     tx.amount,
								created:	tx.created
							}
							chains[i.chain].txs[key] = address
						}
					}
				}
			}
		}

		for(let i in chains) {
			if (chains[i].scan) {
				if (chains[i].utxo) {
					new UtxoScan(i, !!chains[i].mempool, chains[i], actions).init()
				} else if (chains[i].evm) {
					new EvmScan(i, !!chains[i].mempool, chains[i], actions).init()
				}
			}
		}
	} catch (error:any) {
		setlog(error)
	}
}

const serverResponse = async (req:express.Request, res:express.Response, cb:(token:string|null)=>Promise<ServerResponse>) => {
	try {
		let isAdmin = false
		let token = req.headers["x-token"] || ''
		res.json(await cb(token ? <string>token : null))
	} catch (error:any) {
		setlog(req.originalUrl, error)
		if (error.code===11000) {
			res.json({error:1007})
		} else {
			res.json({error:-32000})
		}
	}
}

router.post('/api/rpc/:chain', async(req, res) => {
	const {chain} = req.params as any
	try {
		if (chains[chain]!==undefined && chains[chain].rpc[0]) {
			// console.log('domain', chain, 'rpc', chains[chain].rpc[0], 'body', req.body)
			const response = await callRpc('api-' + chain, chains[chain], req.body)
			res.json(response)
		} else {
			console.log('unknown chain', chain)
			res.status(404).send('')
		}
	} catch (error) {
		res.json({error})
	}
})

router.post('/', async(req, res, next) => {
	const domain = req.hostname
	if (typeof domains[domain]==="string" && domains[domain]!=='') {
		try {
			const response = await callRpc('api-' + domain, domains[domain], req.body)
			res.json(response)
			// console.log('domain', domain, 'rpc', domains[domain])
		} catch (err:any) {
			setlog(domain, err)
		}
	} else {
		console.log('unknown domain ' + domain)
		res.status(404).send('')
	}
})

router.post("/api/v1/admin/add-user", (req:express.Request, res:express.Response)=>{
	serverResponse(req, res, async (token)=>{
		const { username, email, webhook } = req.body as AddUserRequestType
		const _id = getNewId()
		await Users.insertOne({
			_id,
			username,
			email,
			password: 	hmac256("123456"),
			status:   	100,
			webhook,
			tokens:		[],
			lastSeen: 	0,
			updated:  	0,
			created:  	now()
		})
		webhooks[_id.toHexString()] = webhook
		return {result:true}
	})
})

router.post("/api/v1/admin/get-chain-params", (req:express.Request, res:express.Response)=>{
	serverResponse(req, res, async (token)=>{
		const { chain } = req.body as GetChainParamRequestType
		if (chains[chain]) {
			return {
				result: chains[chain]
			}
		} else {
			return {error:1002, message: 'unknown chain'}
		}
	})
})

router.post("/api/v1/admin/set-scan-position", (req:express.Request, res:express.Response)=>{
	serverResponse(req, res, async (token)=>{
		const { chain, position } = req.body as SetblockheightRequestType
		if (chains[chain]) {
			const old = chains[chain].height
			chains[chain].scanPosition = position
			return {
				result: {
					oldHeight: old,
				}
			}
		} else {
			return {error:1002, message: 'unknown chain'}
		}
	})
})

router.post("/api/v1/add-address", (req:express.Request, res:express.Response)=>{
	serverResponse(req, res, async (token)=>{
		if (token) {
			const { data } = req.body as AddAddressRequestType
			const user = await Users.findOne({_id:getObjectId(token)})
			if (user) {
				const uid = user._id.toHexString()
				const inserts = [] as Array<{
					_id: 		ObjectId
					uid:		ObjectId
					chain:		string
					address:	string
					balances:	{}
					txs:		{}
				}>
				for(let i of data) {
					if (i.chain==='evm') {
						for(let ic in chains) {
							const address = i.address.toLowerCase()
							if (chains[ic].evm && chains[ic].addrs[address]===undefined) {
								chains[ic].addrs[address] = {
									uid,
									txs: {}
								}
								inserts.push({
									_id:		getNewId(),
									uid:		user._id,
									chain:		ic,
									address,
									balances:	{},
									txs:		{}
								})
							}
						}
					} else {
						let chain = i.chain
						if (chains[chain].addrs[i.address]===undefined) {
							chains[chain].addrs[i.address] = {
								uid,
								txs: {}
							}
							inserts.push({
								_id:		getNewId(),
								uid:		user._id,
								chain:		chain,
								address:	i.address,
								balances:	{},
								txs:		{}
							})
						}
					}
				}
				if (inserts.length) {
					const result = await Wallets.insertMany(inserts)
					return {result:result.insertedCount!==0}
				}
				return {result:false}
			} else {
				return {error:1001}
			}
		} else {
			return {error:1000}
		}
	})
})

router.post("/api/v1/remove-address", (req:express.Request, res:express.Response)=>{
	serverResponse(req, res, async (token)=>{
		const { data } = req.body as AddAddressRequestType
		if (token) {
			const user = await Users.findOne({_id:getObjectId(token)})
			if (user) {
				return {result:false}
			} else {
				return {error:1001}
			}
		} else {
			return {error:1000}
		}
	})
})

router.post("/api/v1/get-utxo", (req:express.Request, res:express.Response)=>{
	serverResponse(req, res, async (token)=>{
		/* const { address } = req.body as AddUserRequestType
		const _id = getNewId()
		await Users.insertOne({
			_id,
			username,
			email,
			password: 	hmac256("123456"),
			status:   	100,
			webhook,
			tokens:		[],
			lastSeen: 	0,
			updated:  	0,
			created:  	now()
		})
		webhooks[_id.toHexString()] = webhook */
		return {result:true}
	})
})

export default router