require("dotenv").config();
process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";

import * as http from 'http';
import * as https from 'https';
import * as fs from 'fs';
import * as express from 'express';
/* import * as request from 'request'; */
import * as shrinkRay from 'shrink-ray-current'
import * as cors from 'cors'
import Model from './Model';
import { setlog } from './helper';
import router , {initApi} from './api';

const port = Number(process.env.HTTP_PORT || 80)
const portHttps = Number(process.env.HTTPS_PORT || 443)

process.on("uncaughtException", (err:Error) => setlog('exception',err));
process.on("unhandledRejection", (err:Error) => setlog('rejection',err));

Date.now = () => Math.round((new Date().getTime()) / 1000);

Model.connect().then(async ()=>{
	try {
		const app = express()
		const server = http.createServer(app)
		let serverHttps:any = null;
		const file_key = __dirname+'/../certs/portal.api.key';
		const file_crt = __dirname+'/../certs/portal.api.pem';
		if (fs.existsSync(file_key) && fs.existsSync(file_crt)) {
			const key = fs.readFileSync(file_key, 'utf8')
			const cert = fs.readFileSync(file_crt, 'utf8')
			const options = {cert,key}
			serverHttps = https.createServer(options,app)
		} else {
			console.log("Did not find ssl files, disabled ssl features.")
		}
		
		app.use(shrinkRay())
		app.use(cors({
			origin: function(origin, callback){
				return callback(null, true)
			}
		}))
		app.use(express.urlencoded({extended: false}))
		app.use(express.json())
		app.use(express.raw({type: 'application/octet-stream', limit : '2mb'}))
		app.use(router)
		let time = +new Date()
		await new Promise(resolve=>server.listen(port, ()=>resolve(true)))
		setlog(`Started HTTP service on port ${port}. ${+new Date()-time}ms`)
		time = +new Date()
		if (serverHttps) {
			await new Promise(resolve=>serverHttps.listen(portHttps, ()=>resolve(true)))
			setlog(`Started HTTPS service on port ${portHttps}. ${+new Date()-time}ms`)
		}
		await initApi()
	} catch (err:any) {
		setlog("init", err)
		process.exit(1)
	}
})