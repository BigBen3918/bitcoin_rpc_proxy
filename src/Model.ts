require('dotenv').config()
import { MongoClient, ObjectId } from 'mongodb';

const client = new MongoClient('mongodb://localhost:27017');
const db = client.db("rpc");

export const getNewId = () => new ObjectId()
export const getObjectId = (id:string) => new ObjectId(id)

/* interface SchemaAddrs {
	_id: 		ObjectId
	uid: 		ObjectId
	chain: 		string
	address: 	string
	updated: 	number
	created: 	number
}

export const Addrs = db.collection<SchemaAddrs>('addrs'); */

/* interface SchemaTx {
	_id: 		ObjectId
	chain: 		string
	address:	string
	txid: 		string
	height: 	number
	vout: 		number
	rbf: 	    boolean
	coin: 		string
	amount: 	number
	spenttx?:	string
	created:	number
}

export const Txs = db.collection<SchemaTx>('txs'); */

/* interface SchemaWallets {
	_id: 		ObjectId
	uid: 		ObjectId
	chain: 		string
	address: 	string
	status: 	number
	balances: {
		[coin:string]:{
			balance: number
			locked:	 number
		}
	}
	lastSeen:	number
	updated: 	number
	created: 	number
}
export const Wallets = db.collection<SchemaWallets>('wallets'); */

interface SchemaBlocks {
	_id: 		ObjectId
	chain: 		string
	height: 	number
}

export const Blocks = db.collection<SchemaBlocks>('blocks');

export interface WalletTxType {
	txid:		string
	height: 	number
	vout?: 		number
	rbf?: 	    boolean
	coin: 		string
	amount: 	string
	spenttx?:	string
	error?:		boolean
	created:	number
}

interface SchemaWallets {
	_id: 		ObjectId
	uid:		ObjectId
	chain:		string
	address:	string
	balances: {
		[coin:string]: number
	}
	txs:{
		[key:string]: WalletTxType
	}
}
export const Wallets = db.collection<SchemaWallets>('wallets');

interface SchemaPending {
	_id: 		ObjectId
	chain:		string
	txs:{
		[key:string]: TxType
	}
}
export const Pending = db.collection<SchemaPending>('pending');

interface SchemaUsers {
	_id: 		ObjectId
	username: 	string
	email:    	string
	password: 	string
	status:   	number
	webhook:	string
	tokens:		Array<{
		chain:string
		contract:string
		symbol:string
		decimals:number	
	}>,
	lastSeen: 	number
	updated:  	number
	created:  	number
}
export const Users = db.collection<SchemaUsers>('users');

interface SchemaAdmins {
	_id: 		ObjectId
	username: 	string
	email:    	string
	password: 	string
	status:   	number
	lastSeen: 	number
	updated:  	number
	created:  	number
}
export const Admins = db.collection<SchemaAdmins>('admins');


const connect = async () => {
	try {
		console.log('Connecting to MongoDB cluster...');
		await client.connect();
		console.log('Successfully connected to MongoDB!');

		Users.createIndex({ username: 1 }, { unique: true })
		Users.createIndex({ email: 1 }, { unique: true })
		Wallets.createIndex({chain: 1, address: 1})
		Pending.createIndex({chain: 1})

		Admins.createIndex({ username: 1 }, { unique: true })
		Admins.createIndex({ email: 1 }, { unique: true })
		Blocks.createIndex({ chain: 1 }, { unique: true })
	} catch (error) {
		console.error('Connection to MongoDB failed!', error);
		process.exit();
	}
}

export default { connect };