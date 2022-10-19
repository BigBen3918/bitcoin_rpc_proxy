process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";
import axios from 'axios'

const callWebhook = async (url:string, json:any):Promise<boolean>=>{
	try {
		const response = await axios.post(url, json, {timeout: 60000, headers: {'Content-Type': 'application/json'}})
		if (response!==null && response.data) {
			// console.log(colors.yellow('webhook ') + colors.white(url) + ' ' + (response.data.result ? colors.green('success') : colors.red('fail')))
			if (response.data.result!==undefined) return true
		}

	} catch (error:any) {
		console.log(error)
	}
	return false
}

callWebhook("https://127.0.0.1:8443/api/v1/chainapi/deposit", {"chain": "ltc","txs": [{"address":    	"mst3kS4ZpoYKgMzaQ85NCZeedmGGw4EfSt","txid":"d19783e4bf626a46052ee3463f1c714c33214dcb95922ff2f408bc18e4269074","height":2155800,"confirmations":6,"vout":0,"rbf":false,"coin":"ltc","amount":"19398208","created":1642060580}]})