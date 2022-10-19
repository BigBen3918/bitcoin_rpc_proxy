# icicb-portal-backend

### Error Code
| code | message | meaning |
| --- | --- | --- |
| 1000 | access token | require access token |
| 1001 | unregistered user | unregistered user |
| 1002 | unknown chain | unknown chain |
| -32700 | Parse error | Invalid JSON was received by the server. An error occurred on the server while parsing the JSON text. |
| -32600 | Invalid Request | The JSON sent is not a valid Request object. |
| -32601 | Method not found | The method does not exist / is not available. |
| -32602 | Invalid params | Invalid method parameter(s). |
| -32603 | Internal error | Internal JSON-RPC error. |
| -32000 | Server error | Reserved for implementation-defined server-errors. |

## API
> /api/v1/admin/add-user
```
in: 
	interface AddUserRequestType {
		username: 	string
		email:    	string
		webhook:    string
	}

out: 
	interface ServerResponse {
		result?: boolean | undefined
		error?: number
	}
```

> /api/v1/admin/set-scan-position
```
in: 
	interface SetblockheightRequestType {
		chain:    	string
		position:   number
	}

out: 
	interface ServerResponse {
		result?: 	{
			oldHeight: number
		}
		error?: 	number
		message?: 	string
	}
```

> /api/v1/add-address
```
in: 
	interface AddAddressRequestType {
		data: Array<{
			chain: string
			address: string
		}>
	}
out: 
	interface ServerResponse {
		result?: boolean | undefined
		error?: number
	}
```

> /api/v1/get-utxo
```
in: 
	interface AddAddressRequestType {
		token: string
		data: Array<{
			chain: string
			address: string
		}>
	}
out: 
	interface ServerResponse {
		result?: boolean | undefined
		error?: number
	}
```