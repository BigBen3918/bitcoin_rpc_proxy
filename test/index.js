require('colors')
/* require('dotenv').config() */

const Model = require('../src/Model');
const UtxoModel =  require('../src/chains/UtxoModel').default
const {actions} = require('../src/api')
const { expect } = require("chai");

let utxoModel;

describe("testing litecoin", ()=>{
	it("connecting mongodb", async ()=>{
		await Model.connect()
        expect(true);
	})
	it("instancing utxo module", async ()=>{
		utxoModel = new UtxoModel("ltctest", true, chains['ltctest'], actions);
		expect(!utxoModel);
	})
	it("instancing utxo module", async ()=>{
		utxoModel = new UtxoModel("ltctest", true, chains['ltctest'], actions);
		expect(!utxoModel);
	})
	it("checking mempool", async ()=>{
		await utxoModel.readPool()
		expect(true)
	})
	it("checking [checkTxs]", async ()=>{
		/* utxoModel.checkTxs([
            'b5d38b78246c0148f3462740fa225994a47b20ebbb5d60c0c8d532ede5d99465',
            'b5d38b78246c0148f3462740fa225994a47b20ebbb5d60c0c8d532ede5d99465',

        ], height:number, time:number)
		expect(!utxoModel); */
	})
})