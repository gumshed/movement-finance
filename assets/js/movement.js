var BN = web3.utils.BN;

var accountBalance = new Object();
var accountBorrow = new Object();
var prices = new Object();	
var enableCollateral = new Object();	
var assetsIn;
var accountLiquidityAvailable;
const gasLimitStake = 300000;
const gasLimitApprove = 70000;

var formatter = new Intl.NumberFormat('us-US', {
  style: 'currency',
  currency: 'USD',
});

var _MAINNET_ENV = {
	"id": 1,
	"mvtAddress": "0x3d46454212c61ecb7b31248047fa033120b88668",
	"uniswapMiningAddress": "0xC7ED274D6e2A158CDBE8DA8141000AFFA11D33E5",
	"lpAddress": "0xbcc5378b8bc3a305ac30501357467a824de8fe55",
	"uniswapAddress": "0xbcc5378b8bc3a305ac30501357467a824de8fe55",
	"etherscan": "https://etherscan.io/",
	
}

var _GOERLI_ENV = {
	"id": 5,
	"mvtAddress": "0xfcfc79623431ccf254f01091d4c8b2ce7722b1f1",
	"uniswapMiningAddress": "0x51b668098047f3FF45BDCB0449604f060FD0e4F4",
	"lpAddress": "0xc270f9d3800d308ee7a5213164650be9372ae1f9",
	"uniswapAddress": "0x8f5702821cB454081AAfE1232b89957E19B89Cd7",
	"etherscan": "https://goerli.etherscan.io/",
	
}

var ENV = _MAINNET_ENV;
var OLD_ENVID;
change_environment = function(chainId){
	if(!chainId) return false;
	
	OLD_ENVID = ENV.id;
	
	if(chainId=='0x1'||chainId=='0x01'){ //mainnet
		ENV = _MAINNET_ENV;
		$('.goerli-testnet').addClass('d-none');
		$('.mainnet').removeClass('d-none');
		
	}
	else if(chainId=='0x5'||chainId=='0x05'){
		ENV = _GOERLI_ENV;
		$('.mainnet').addClass('d-none');
		$('.goerli-testnet').removeClass('d-none');
	}
	else{
		Swal.fire(
		  'Only support Mainnet and Goerli',
		  '',
		  'warning'
		)
		return false;
	}
	
	if(page=='main'){ 
		syncCont();
		if(account) syncAccount(account);
	}
	else if(page=='genesis') init_genesis();
	else if(page=='staking') init_staking();
	
	if(OLD_ENVID!=ENV.id){
		setTimeout(refreshData, 50);
	}
	
	return true;
}

const blocksPerDay = 4 * 60 * 24;
const daysPerYear = 365;
const mentissa = 1e18;

async function asyncForEach(array, callback) {
  for (let index = 0; index < array.length; index++) {
    await callback(array[index], index, array);
  }
}

var pop_enable = function(cont){
	
	$('#enable-form .coin_img').attr('src', cont.logo);
	$('#enable-form .val_coin_name').html(cont.name);
	$('#enable-form .coin_btn_lanjut').html('Continue').attr('onclick', 'go_enable(\''+cont.id+'\'); return false;');
	
	$.magnificPopup.open({
		items: {
			src: '#enable-form',
			type: 'inline'
		},
		showCloseBtn: false
	});
}

var go_enable = async function(id){
	var cont;
	Object.values(ENV.cTokens).forEach(function(cItem, cIndex){
		if(cItem.id == id) cont = cItem;
	});
	
	$('#enable-form .coin_btn_lanjut').html('<span class="mdi mdi-loading mdi-spin"></span> Open MetaMask').attr('onclick', '');
	
	var token = new web3.eth.Contract(erc20Abi, cont.underlyingAddress);
	var raw_amount = 99999999999999999999*Math.pow(10, cont.underlyingDecimals);
	var allowance = await token.methods.approve(cont.address, numberToString(raw_amount)).send({
		from: account,
		gas: gasLimitApprove
	}, function(err, result){
		if (err) {
			$.magnificPopup.close();
			Swal.fire(
			  'Failed',
			  err.message,
			  'error'
			)
		} else {
			$.magnificPopup.close();
			Swal.fire(
			  'Transaction Sent',
			  'Please wait the transaction to be confirmed, then you can start to supply this token.<br /><br />'+result+' <a href="'+ENV.etherscan+'tx/'+result+'" target="_blank"><span class="mdi mdi-open-in-new"></span></a>',
			  'success'
			)
		}
	});
}

var refreshData = function(){
	syncRate();
	syncAccount(account);
}

function numberToString(num)
{
    let numStr = String(num);

    if (Math.abs(num) < 1.0)
    {
        let e = parseInt(num.toString().split('e-')[1]);
        if (e)
        {
            let negative = num < 0;
            if (negative) num *= -1
            num *= Math.pow(10, e - 1);
            numStr = '0.' + (new Array(e)).join('0') + num.toString().substring(2);
            if (negative) numStr = "-" + numStr;
        }
    }
    else
    {
        let e = parseInt(num.toString().split('+')[1]);
        if (e > 20)
        {
            e -= 20;
            num /= Math.pow(10, e);
            numStr = num.toString() + (new Array(e + 1)).join('0');
        }
    }

    return numStr;
}

var toMaxDecimal = function(num, max=8){
	if(typeof num=='float') num = num.toString();
	
	if(!num) return '0';
	num = num+"";
	
	var tmp = num.split('.');
	
	if(!tmp[1]){
		return tmp[0];
	}
	
	var decNow = tmp[1].length;
	
	if(decNow>max){
		num = tmp[0]+'.'+tmp[1].substring(0, max);
	}
	return num;
}

$(function(){
	if(page=='main'){

		syncCont();
		displayCoinList();
		refreshData();

		setInterval(function(){
			refreshData();
		}, 60000);
		
	}
	else if(page=='genesis'){
		init_genesis();

		setInterval(function(){
			init_genesis();
		}, 60000);
	}
});