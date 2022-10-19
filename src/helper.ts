require("dotenv").config();
import * as fs from 'fs';
import * as crypto from 'crypto';
import axios from 'axios';

const colors = require('colors')
const secret = process.env.APP_SECRET || ''

export const now = () => Math.round(new Date().getTime()/1000)
export const hmac256 = (message:string) => crypto.createHmac('SHA256', secret).update(message).digest('hex')

export const setlog = function(title:string,msg?:any,noWrite?:boolean) {
	const date = new Date();
	const datetext:string = [date.getUTCFullYear(), ('0' + (date.getUTCMonth() + 1)).slice(-2), ('0' + date.getUTCDate()).slice(-2)].join('-')
	const timetext:string = [('0' + date.getUTCHours()).slice(-2), ('0' + date.getUTCMinutes()).slice(-2), ('0' + date.getUTCSeconds()).slice(-2)].join(':')
	let isError = false
	if (msg instanceof Error) {
		msg = msg.stack || msg.message
		isError = true
	}
	if (msg) msg = msg.split(/\r\n|\r|\n/g).map((v:any)=>'\t' + String(v)).join('\r\n')
	if (!noWrite) fs.appendFileSync(__dirname + '/../logs/' + datetext+'.log', `[${timetext}] ${title}\r\n${msg ? msg + '\r\n' : ''}`)
	if (msg && isError) msg = colors.red(msg)
	console.log(
		colors.gray('[' + timetext + ']'),
		colors.white(title),
		msg ? '\r\n' + msg : ''
	)
}

export const callRpc = async (chain:string, net:string|NetworkType, json:any) => {
	try {
		if (typeof net==='string') {
			const response = await axios.post(net, json, {timeout: 60000, headers: {'Content-Type': 'application/json'}})
			return response.data
		} else {
			const count = net.rpc.length
			for(let k=0; k<count; k++) {
				let index = (net.rpcIndex || 0) + k
				if (index>=count) index -= count
				const response = await axios.post(net.rpc[index], json, {timeout: 60000, headers: {'Content-Type': 'application/json'}})
				if (response && response.data) {
					if (index!==net.rpcIndex) net.rpcIndex = index
					return response.data
				} else {
					setlog(chain, `#${index} [${net.rpc[index]}] RPC failded`)
				}
			}
		}
	} catch(error:any) {
		setlog(chain, error)
		return null
	}
}