const Redis = require('ioredis');
const redis = new Redis({
    host: 'localhost',
    port: 6379
});

redis.on('error', (err:any) => {
	console.error("This demo requires Redis, a simple message broker. To install redis on Mac OS X, use `brew install redis`");
	console.error("After installing, run `redis-server` in another terminal and restart this demo.");
	console.error(err);
 
	// In production, this will trigger a process monitor to restart the process.
	
});
 
redis.on('connect', ()=>{
	console.log("redis connected")
});

/* import { createClient } from 'redis';

const client = createClient({url:'redis://127.0.0.1/6379'});

 */
   
export const getSession = async (key:string):Promise<SessionType|null>=>{
	try {
		  const buf = await redis.get(key)
		if (buf) return JSON.parse(buf) as SessionType
	} catch (err) {
		console.log('getSession', err)
	}
	return null
}

export const setSession = async (key:string, value:SessionType)=>{
	try {
		await redis.set(key, JSON.stringify(value))
	} catch (err) {
		console.log('setSession', err)
	}
}


export default {
	
	/* connect: redis.connect */
}