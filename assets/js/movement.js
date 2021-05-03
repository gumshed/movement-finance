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

var syncCont = function(){
	
	if(page!='main') return;
	
	ENV = _GOERLI_ENV;
	
	ENV.comptrollerContract = new web3.eth.Contract(comptrollerAbi, ENV.comptrollerAddress);
	ENV.oracleContract = new web3.eth.Contract(oracleAbi, ENV.oracleAddress);
	Object.values(ENV.cTokens).forEach(async function(cToken, index){
		ENV.cTokens[cToken.id].contract = new web3.eth.Contract(cErc20Abi, cToken.address);
	});
}

const blocksPerDay = 4 * 60 * 24;
const daysPerYear = 365;
const mentissa = 1e18;

async function asyncForEach(array, callback) {
  for (let index = 0; index < array.length; index++) {
    await callback(array[index], index, array);
  }
}

var syncRate = function(){
	
	if(page!='main') return;
	
	ENV = _GOERLI_ENV;
	
	Object.values(ENV.cTokens).forEach(async function(cToken, index){
	
		var supplyRatePerBlock = await cToken.contract.methods.supplyRatePerBlock().call();
		var borrowRatePerBlock = await cToken.contract.methods.borrowRatePerBlock().call();
		var supplyApy = (((Math.pow((supplyRatePerBlock / mentissa * blocksPerDay) + 1, daysPerYear - 1))) - 1) * 100;
		var borrowApy = (((Math.pow((borrowRatePerBlock / mentissa * blocksPerDay) + 1, daysPerYear - 1))) - 1) * 100;
		
		$(`.val_${cToken.id}_apy`).html(supplyApy.toFixed(2)+'%');
		$(`.val_${cToken.id}_rate`).html(borrowApy.toFixed(2)+'%');
		
		var collateralFactorMantissa = await ENV.comptrollerContract.methods.getcollateralFactorMantissa(cToken.address).call();
		var collateralFactor = collateralFactorMantissa / mentissa * 100;
		
		$(`.val_${cToken.id}_collateral_percentage`).html(collateralFactor.toFixed(0)+'%');
		
		
	});
	
}

var getBalance = async function(cToken, address){
			
	if(!address){
		return 0;
	}
	
	if(cToken.id=='eth'){
		var balance = await web3.eth.getBalance(address);
		balance = web3.utils.fromWei(balance);
		return balance;
	}
	
	var token = new web3.eth.Contract(erc20Abi, cToken.underlyingAddress);
	var balance = await token.methods.balanceOf(address).call();
	
	balance = balance / Math.pow(10, cToken.underlyingDecimals);
	
	return balance;
	
}

var syncAccount = async function(address){
	
	if(page!='main') return;
	
	ENV = _GOERLI_ENV;
			
	if(!address){
		Object.values(ENV.cTokens).forEach(function(cToken, cIndex){
			$(`.val_${cToken.id}_balance_underlying`).html('0 '+cToken.unit);
			$(`.val_${cToken.id}_balance_borrow`).html('0 '+cToken.unit);
		});
		return;
	}
	
	$('.refresh-btn').addClass('mdi-spin');
	
	var i = 0;
	
	var assetsIn = await ENV.comptrollerContract.methods.getAssetsIn(address).call();
	
	Object.values(ENV.cTokens).forEach(async function(cToken, cIndex){
		var exchangeRateStored = await cToken.contract.methods.exchangeRateStored().call();
		var cTokenBalance = await cToken.contract.methods.balanceOf(address).call();
		var underlyingBalance = cTokenBalance*exchangeRateStored / (Math.pow (10, 18 + cToken.underlyingDecimals));
		
		accountBalance[cToken.id] = underlyingBalance;
		
		$(`.val_${cToken.id}_balance_underlying`).html(parseFloat(underlyingBalance).toFixed(8)+' '+cToken.unit);
		
		var borrowBalanceStored = await cToken.contract.methods.borrowBalanceStored(address).call();
		var borrowBalance = borrowBalanceStored/Math.pow(10, cToken.underlyingDecimals);
		
		accountBorrow[cToken.id] = new Object();
		
		accountBorrow[cToken.id] = borrowBalance;
		
		$(`.val_${cToken.id}_balance_borrow`).html(parseFloat(borrowBalance).toFixed(8)+' '+cToken.unit);
		
		if($.inArray(cToken.address, assetsIn) >= 0){
			//collateral is enabled
			enableCollateral[cToken.id] = true;
			$('.'+cToken.id+'_is_collateral').prop( "checked", true );
		}
		else{
			//collateral is disabled
			enableCollateral[cToken.id] = false;
			$('.'+cToken.id+'_is_collateral').prop( "checked", false );
		}
		
		i++;
		if(i==Object.keys(ENV.cTokens).length) getPrices();
	});
	
	
	$('.refresh-btn').removeClass('mdi-spin');
}

var getPrices = async function(){
	
	var addresses = '';
	var i = 0;
	
	Object.values(ENV.cTokens).forEach(async function(CToken, cIndex){
		prices[CToken.id] = await ENV.oracleContract.methods.getUnderlyingPrice(CToken.address).call() / Math.pow(10, 36-CToken.underlyingDecimals);
		
		i++;
		if(i==Object.keys(ENV.cTokens).length) updatePrices();
	});
	
}

var updatePrices = function(){
	
	var supplyInUsd = 0;
	var borrowInUsd = 0;
	
	var i = 0;
	
	Object.values(ENV.cTokens).forEach(function(cToken, index){
		if(!prices[cToken.id]) return;
		
		var balance = accountBalance[cToken.id];
		var price = prices[cToken.id];
		
		var underlying_usd = balance*price;
		
		supplyInUsd += underlying_usd;
		
		$(`.val_${cToken.id}_balance_underlying_usd`).html(formatter.format(parseFloat(underlying_usd).toFixed(2)));
		
		var borrow = accountBorrow[cToken.id];
		var borrow_usd = borrow*price;
		
		borrowInUsd += borrow_usd;
		
		$(`.val_${cToken.id}_balance_borrow_usd`).html(formatter.format(parseFloat(borrow_usd).toFixed(2)));
		
		
		i++;
		if(i==Object.keys(ENV.cTokens).length){ 
			$('.supply-balance').html(formatter.format(parseFloat(supplyInUsd).toFixed(2)));
			$('.borrow-balance').html(formatter.format(parseFloat(borrowInUsd).toFixed(2)));
			updateBorrowLimit(borrowInUsd);
		}
		
	});
	
	
}

var updateBorrowLimit = async function(borrowInUsd){
	var temp = await ENV.comptrollerContract.methods.getAccountLiquidity(account).call();
	var accountLiquidity = temp[1];
	var accountLiquidityUsd = accountLiquidity / mentissa;
	var totalLimitUsd = accountLiquidityUsd + borrowInUsd;
	var borrowPercentage = parseFloat(borrowInUsd/totalLimitUsd*100).toFixed(2);
	
	accountLiquidityAvailable = accountLiquidity;
	
	$('.borrow-limit').html(formatter.format(parseFloat(totalLimitUsd).toFixed(2)));
	
	var borrowPercentageString = borrowPercentage+"%";
	$('.borrow-percentage').html(borrowPercentageString).css({width: borrowPercentageString}).attr('aria-valuenow', borrowPercentage).attr('aria-valuemin', borrowPercentage);
}

var enableCollateral = async function(id){
	
	if(!account){
		Swal.fire(
		  'Error',
		  'Connect MetaMask to continue.',
		  'error'
		)
		return;
	}
	
	Object.values(ENV.cTokens).forEach(function(cItem, cIndex){
		if(cItem.id == id) cont = cItem;
	});
	
	var cTokenId = cont.id;
	await ENV.comptrollerContract.methods.enterMarkets([cont.address]).send({
			from: account
		}, function(err, result){
		if (err) {
			$('.'+cTokenId+'_is_collateral').prop( "checked", false );
			Swal.fire(
			  'Failed',
			  err.message,
			  'error'
			);
		} else {
			Swal.fire(
			  'Transaction Sent',
			  result+' <a href="'+ENV.etherscan+'tx/'+result+'" target="_blank"><span class="mdi mdi-open-in-new"></span></a>',
			  'success'
			)
		}
	});
}

var disableCollateral = async function(id){
	
	if(!account){
		Swal.fire(
		  'Error',
		  'Connect MetaMask to continue.',
		  'error'
		)
		return;
	}
	
	Object.values(ENV.cTokens).forEach(function(cItem, cIndex){
		if(cItem.id == id) cont = cItem;
	});
	
	var cTokenId = cont.id;
	await ENV.comptrollerContract.methods.exitMarket(cont.address).send({
			from: account
		}, function(err, result){
		if (err) {
			$('.'+cTokenId+'_is_collateral').prop( "checked", true );
			Swal.fire(
			  'Failed',
			  err.message,
			  'error'
			);
		} else {
			Swal.fire(
			  'Transaction Sent',
			  result+' <a href="'+ENV.etherscan+'tx/'+result+'" target="_blank"><span class="mdi mdi-open-in-new"></span></a>',
			  'success'
			);
		}
	});
}

var displayCoinList = function(){
	cTokens = ENV.cTokens;
	
	$('.supplies_container').html('');
	Object.values(cTokens).forEach(function(item, index){
		var html = $($('#template_supply_item').html());
		$(html).find('img.coin-logo').attr('src', item.logo);
		$(html).find('.coin-name').html(item.unit);
		$(html).find('.coin_val_apy').addClass('val_'+item.id+'_apy');
		$(html).find('.coin_val_balance_underlying').addClass('val_'+item.id+'_balance_underlying');
		$(html).find('.coin_val_balance_underlying_usd').addClass('val_'+item.id+'_balance_underlying_usd');
		$(html).addClass('supply-item').attr('token', item.id);
		$(html).find('input[type="checkbox"]').addClass(item.id+'_is_collateral');
		
		$(html).find('input[type="checkbox"]').last().attr('id', item.id+'_is_collateral');
		$(html).find('.custom-control-label').last().attr('for', item.id+'_is_collateral');
		
		$(html).find('input[type="checkbox"]').first().attr('id', item.id+'_is_collateral_2');
		$(html).find('.custom-control-label').first().attr('for', item.id+'_is_collateral_2');
		
		$(html).find('.coin_collateral_percentage').addClass('val_'+item.id+'_collateral_percentage');
		
		
		$(html).find('input[type="checkbox"]').click(function(e){
			let isEnabled =  enableCollateral[item.id];
			if(isEnabled) disableCollateral(item.id);
			else enableCollateral(item.id);
		});
		
		
		$(html).click(function(e){
			if( 
				$(e.target).closest(".collateral-col").length == 0 &&
				$(e.target).closest("abbr").length == 0 
			) {
				pop_depo(item.id);
			}
			
		});
		
		$('.supplies_container').append(html);
	});
	
	$('.borrows_container').html('');
	Object.values(cTokens).forEach(function(item, index){
		var html = $($('#template_borrow_item').html());
		$(html).find('img.coin-logo').attr('src', item.logo);
		$(html).find('.coin-name').html(item.unit);
		$(html).find('.coin_val_rate').addClass('val_'+item.id+'_rate');
		$(html).find('.coin_val_balance_borrow').addClass('val_'+item.id+'_balance_borrow');
		$(html).find('.coin_val_balance_borrow_usd').addClass('val_'+item.id+'_balance_borrow_usd');
		
		
		$(html).click(function(e){
			if( 
				$(e.target).closest("abbr").length == 0 
			) {
				pop_borrow(item.id);
			}
			
		});
		
		$('.borrows_container').append(html);
	});
}

var pop_depo = async function(id){
	
	$.magnificPopup.close();
	
	if(!account){
		Swal.fire(
		  'Error',
		  'Connect MetaMask to continue.',
		  'error'
		)
		return;
	}
	
	var cont;
	
	Object.values(ENV.cTokens).forEach(function(cItem, cIndex){
		if(cItem.id == id) cont = cItem;
	});
	
	if(cont.id!='eth'){
	
		var token = new web3.eth.Contract(erc20Abi, cont.underlyingAddress);
		var allowance = await token.methods.allowance(account, cont.address).call();
		allowance = allowance / Math.pow(10, cont.underlyingDecimals);
		if(allowance<9999999999){ //allowance not enough, ask to approve
		
			pop_enable(cont);
			return;
		}
	}
	
	
	$('#depo-form .coin_img').attr('src', cont.logo);
	$('#depo-form .val_coin_name').html(cont.name);
	$('#depo-form .val_coin_balance').html('');
	$('#depo-form .val_coin_unit').html(cont.unit);
	$('#depo-form .coin_btn_lanjut').html('Continue').attr('onclick', 'go_depo(\''+cont.id+'\'); return false;');
	$('#depo-form .coin_btn_redeem').attr('onclick', 'pop_wd(\''+cont.id+'\'); return false;');
	$('#depo_amount').attr('placeholder', 'Enter the amount of '+cont.unit).val('');
	$('#depo_amount').val('');
	
	setTimeout(function(){
		
		$.magnificPopup.open({
			items: {
				src: '#depo-form',
				type: 'inline'
			},
			showCloseBtn: false
		});
	
	}, 5);
	
	var avail_balance = await getBalance(cont, account);
	
	$('#depo-form .val_coin_balance').html(parseFloat(avail_balance).toFixed(8));
	
}

var go_depo = async function(id){
	var cont;
	Object.values(cTokens).forEach(function(cItem, cIndex){
		if(cItem.id == id) cont = cItem;
	});
	var amount = $('#depo_amount').val();
	if(!amount||isNaN(amount)||amount<=0){
		Swal.fire(
		  'Error',
		  'Enter valid amount.',
		  'error'
		)
		return false;
	}
	
	cToken =  new web3.eth.Contract(cErc20Abi, cont.address);
	
	$('#depo-form .coin_btn_lanjut').html('<span class="mdi mdi-loading mdi-spin"></span> Open MetaMask').attr('onclick', '');
	
	if(cont.id=='eth'){
	
		await cToken.methods.mint().send({
			from: account,
			value: web3.utils.toHex(web3.utils.toWei(amount, 'ether'))
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
				  'Transaksi Terkirim',
				  result+' <a href="'+ENV.etherscan+'tx/'+result+'" target="_blank"><span class="mdi mdi-open-in-new"></span></a>',
				  'success'
				)
			}
		});
		
	}
	else{
		var raw_amount = Math.floor(amount * Math.pow(10, cont.underlyingDecimals));
		await cToken.methods.mint(numberToString(raw_amount)).send({
			from: account
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
				  'Transaksi Terkirim',
				  result+' <a href="'+ENV.etherscan+'tx/'+result+'" target="_blank"><span class="mdi mdi-open-in-new"></span></a>',
				  'success'
				)
			}
		});
		
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

var pop_wd = function(id){
	
	$.magnificPopup.close();
	
	if(!account){
		Swal.fire(
		  'Error',
		  'Connect MetaMask to continue.',
		  'error'
		)
		return;
	}
	
	var cont;
	
	Object.values(ENV.cTokens).forEach(function(cItem, cIndex){
		if(cItem.id == id) cont = cItem;
	});
	
	
	$('#wd-form .coin_img').attr('src', cont.logo);
	$('#wd-form .val_coin_name').html(cont.name);
	$('#wd-form .val_coin_balance').html('');
	$('#wd-form .val_coin_unit').html(cont.unit);
	$('#wd-form .coin_btn_lanjut').html('Continue').attr('onclick', 'go_wd(\''+cont.id+'\'); return false;');
	$('#wd-form .coin_btn_depo').attr('onclick', 'pop_depo(\''+cont.id+'\'); return false;');
	$('#wd_amount').attr('placeholder', 'Enter the amount of '+cont.unit).val('');
	$('#wd_amount').val('');
	
	var balance = accountBalance[cont.id];
	
	if(!balance){
		$('#wd-form .val_coin_balance').html(0);
	}
	else{
		$('#wd-form .val_coin_balance').html(parseFloat(balance).toFixed(8));
	}
	
	setTimeout(function(){
	
		$.magnificPopup.open({
			items: {
				src: '#wd-form',
				type: 'inline'
			},
			showCloseBtn: false
		});
	
	}, 5);
	
}

var go_wd = async function(id){
	var cont;
	Object.values(ENV.cTokens).forEach(function(cItem, cIndex){
		if(cItem.id == id) cont = cItem;
	});
	var amount = $('#wd_amount').val();
	if(!amount||isNaN(amount)||amount<=0){
		Swal.fire(
		  'Error',
		  'Enter valid amount.',
		  'error'
		)
		return false;
	}
	
	$('#wd-form .coin_btn_lanjut').html('<span class="mdi mdi-loading mdi-spin"></span> Open MetaMask').attr('onclick', '');
	
	var raw_amount = Math.floor(amount * Math.pow(10, cont.underlyingDecimals));
	
	await cont.contract.methods.redeemUnderlying(numberToString(raw_amount)).send({
		from: account
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
			  result+' <a href="'+ENV.etherscan+'tx/'+result+'" target="_blank"><span class="mdi mdi-open-in-new"></span></a>',
			  'success'
			)
		}
	});
}

var pop_borrow = function(id){
	
	$.magnificPopup.close();
	
	if(!account){
		Swal.fire(
		  'Error',
		  'Connect MetaMask to continue.',
		  'error'
		)
		return;
	}
	
	
	if(!enableCollateral[id]){
		Swal.fire(
		  'Error',
		  'You need to enable this market to start borrowing. Click the Enable switch in the supply section to enable markets.',
		  'error'
		)
		return;
	}
	
	var cont;
	
	Object.values(ENV.cTokens).forEach(function(cItem, cIndex){
		if(cItem.id == id) cont = cItem;
	});
	
	
	$('#borrow-form .coin_img').attr('src', cont.logo);
	$('#borrow-form .val_coin_name').html(cont.name);
	$('#borrow-form .val_coin_maxborrow').html('');
	$('#borrow-form .val_coin_unit').html(cont.unit);
	$('#borrow-form .coin_btn_lanjut').html('Continue').attr('onclick', 'go_borrow(\''+cont.id+'\'); return false;');
	$('#borrow-form .coin_btn_repay').attr('onclick', 'pop_repay(\''+cont.id+'\'); return false;');
	$('#borrow_amount').attr('placeholder', 'Enter the amount of '+cont.unit).val('');
	$('#borrow_amount').val('');
	
	var maxBorrow = accountLiquidityAvailable / mentissa / prices[cont.id];
	
	if(!maxBorrow){
		$('#borrow-form .val_coin_maxborrow').html(0);
	}
	else{
		$('#borrow-form .val_coin_maxborrow').html(parseFloat(maxBorrow).toFixed(8));
	}
	
	setTimeout(function(){
	
		$.magnificPopup.open({
			items: {
				src: '#borrow-form',
				type: 'inline'
			},
			showCloseBtn: false
		});
	
	}, 5);
	
}

var go_borrow = async function(id){
	var cont;
	Object.values(ENV.cTokens).forEach(function(cItem, cIndex){
		if(cItem.id == id) cont = cItem;
	});
	var amount = $('#borrow_amount').val();
	if(!amount||isNaN(amount)||amount<=0){
		Swal.fire(
		  'Error',
		  'Enter valid amount.',
		  'error'
		)
		return false;
	}
	
	$('#borrow-form .coin_btn_lanjut').html('<span class="mdi mdi-loading mdi-spin"></span> Open MetaMask').attr('onclick', '');
	
	var raw_amount = Math.floor(amount * Math.pow(10, cont.underlyingDecimals));
	
	await cont.contract.methods.borrow(numberToString(raw_amount)).send({
		from: account
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
			  result+' <a href="'+ENV.etherscan+'tx/'+result+'" target="_blank"><span class="mdi mdi-open-in-new"></span></a>',
			  'success'
			)
		}
	});
}

var pop_repay = function(id){
	
	$.magnificPopup.close();
	
	if(!account){
		Swal.fire(
		  'Error',
		  'Connect MetaMask to continue.',
		  'error'
		)
		return;
	}
	
	var cont;
	
	Object.values(ENV.cTokens).forEach(function(cItem, cIndex){
		if(cItem.id == id) cont = cItem;
	});
	
	
	$('#repay-form .coin_img').attr('src', cont.logo);
	$('#repay-form .val_coin_name').html(cont.name);
	$('#repay-form .val_coin_debt').html('');
	$('#repay-form .val_coin_unit').html(cont.unit);
	$('#repay-form .coin_btn_lanjut').html('Continue').attr('onclick', 'go_repay(\''+cont.id+'\'); return false;');
	$('#repay-form .coin_btn_borrow').attr('onclick', 'pop_borrow(\''+cont.id+'\'); return false;');
	$('#repay_amount').attr('placeholder', 'Enter the amount of '+cont.unit).val('');
	$('#repay_amount').val('').prop('disabled', false);
	$('#fullrepay').html(parseFloat(debt).toFixed(8)).prop('checked', false).attr('onchange', 'togglerepay(\''+cont.id+'\', true); return false;');
	
	var debt = accountBorrow[cont.id];
	
	if(!debt){
		$('#repay-form .val_coin_debt').html(0);
	}
	else{
		$('#repay-form .val_coin_debt').html(parseFloat(debt).toFixed(8)).attr('onclick', 'togglerepay(\''+cont.id+'\'); return false;');
	}
	
	setTimeout(function(){
	
		$.magnificPopup.open({
			items: {
				src: '#repay-form',
				type: 'inline'
			},
			showCloseBtn: false
		});
	
	}, 5);
	
}

var go_repay = async function(id){
	var cont;
	Object.values(ENV.cTokens).forEach(function(cItem, cIndex){
		if(cItem.id == id) cont = cItem;
	});
	var amount = $('#repay_amount').val();
	if(!amount||isNaN(amount)||amount<=0){
		Swal.fire(
		  'Error',
		  'Enter valid amount.',
		  'error'
		)
		return false;
	}
	
	$('#wd-form .coin_btn_lanjut').html('<span class="mdi mdi-loading mdi-spin"></span> Open MetaMask').attr('onclick', '');
	
	var raw_amount = numberToString(Math.floor(amount * Math.pow(10, cont.underlyingDecimals)));
	
	if($('#fullrepay').is(':checked')){
		raw_amount = '115792089237316195423570985008687907853269984665640564039457584007913129639935';
	}
	
	await cont.contract.methods.repayBorrow(raw_amount).send({
		from: account
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
			  result+' <a href="'+ENV.etherscan+'tx/'+result+'" target="_blank"><span class="mdi mdi-open-in-new"></span></a>',
			  'success'
			)
		}
	});
}

var togglerepay = function(id, reverse=false){
	var debt = accountBorrow[id];
	
	var checked = $('#fullrepay').is(':checked');
	if(reverse) checked = !checked;
		
	if(checked){
		$('#repay_amount').val('').prop('disabled', false);
		$('#fullrepay').prop('checked', false);
	}
	else{
		$('#repay_amount').val(parseFloat(debt).toFixed(8)).prop('disabled', true);
		$('#fullrepay').prop('checked', true);
	}
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


/* genesis */

var getClaimableMvt = async function(address){
	var genesisCont =  new web3.eth.Contract(genesisMiningAbi, ENV.genesisMiningAddress);
	var stakerIndex = await genesisCont.methods.stakerIndexes(address).call();
	var tenStake = await genesisCont.methods.stakeHolders(address).call();
	var currentBlock = await web3.eth.getBlockNumber();
	var miningState = await genesisCont.methods.getMiningState(currentBlock).call();
	
	var deltaIndex = (new BN(miningState[0])).sub(new BN(stakerIndex));
	var mvtDelta = web3.utils.fromWei((new BN (deltaIndex)).mul(new BN(tenStake)));
	
	mvtDelta = mvtDelta.replace(/\.[0-9]+$/, ''); //remove decimals
	
	return mvtDelta;
	
}

var init_genesis = async function(){
	var mvtCont =  new web3.eth.Contract(erc20Abi, ENV.mvtAddress);
	var tenCont =  new web3.eth.Contract(erc20Abi, ENV.cTokens.ten.underlyingAddress);
	var genesisCont =  new web3.eth.Contract(genesisMiningAbi, ENV.genesisMiningAddress);
	
	var total_stake = await genesisCont.methods.totalStaked().call();
	var total_ten_staked = web3.utils.fromWei(total_stake);
	var miningStateBlock = await genesisCont.methods.miningStateBlock().call();
	var startMiningBlockNum = await genesisCont.methods.startMiningBlockNum().call();
	var totalGenesisBlockNum = 205000;
	var genesisProgressPercent = ((miningStateBlock-startMiningBlockNum)/totalGenesisBlockNum*100).toFixed(2);
	var tenMvtPrices = await getTenMvtPrices();
	
	$('.total-stake').html(web3.utils.fromWei(total_stake));
	
	var genesisPercentageString = genesisProgressPercent+"%";
	$('.genesis-percentage').html(genesisPercentageString).css({width: genesisPercentageString}).attr('aria-valuenow', genesisProgressPercent).attr('aria-valuemin', genesisProgressPercent);
	
	$('.tenPrice').html(toMaxDecimal(tenMvtPrices.TEN, 3));
	$('.tadPrice').html(toMaxDecimal(tenMvtPrices.MVT, 3));
	
	//{MVT price} x {genesis distribution} / ( {TEN STAKED} x {TEN price} ) x 12 x 100%
	var apy = tenMvtPrices.MVT*200000 / (total_ten_staked * tenMvtPrices.TEN ) * 12 * 100;
	
	$('.apyGenesis').html(toMaxDecimal(apy, 2));
	
	if(account){
		var tenBalance = await tenCont.methods.balanceOf(account).call();
		var tenStake = await genesisCont.methods.stakeHolders(account).call();
		var claimableMvt = await getClaimableMvt(account);
	
		$('.val_ten_balance').html(toMaxDecimal(web3.utils.fromWei(tenBalance)));
		$('.my-stake, .val_ten_stake').html(web3.utils.fromWei(tenStake));
		$('.mvt-to-claim').html(toMaxDecimal(web3.utils.fromWei(claimableMvt)));
		$('#val_mvt_avail').val(toMaxDecimal(web3.utils.fromWei(claimableMvt)));
	}
	
	
}

var prepare_stake = async function(){
	Swal.fire(
	  'Error',
	  'Genesis Mining period is already finished.',
	  'error'
	)
	return;
	
	if(!account){
		Swal.fire(
		  'Error',
		  'Connect MetaMask to continue.',
		  'error'
		)
		return;
	}
	
	var mvtCont =  new web3.eth.Contract(erc20Abi, ENV.mvtAddress);
	var tenCont =  new web3.eth.Contract(erc20Abi, ENV.cTokens.ten.underlyingAddress);
	var genesisCont =  new web3.eth.Contract(genesisMiningAbi, ENV.genesisMiningAddress);
	
	var stake_amount = $('#stake_amount').val();
	var stake_raw_amount = web3.utils.toWei(stake_amount);
	
	var ten_balance = await tenCont.methods.balanceOf(account).call();
	
	if(!stake_amount){
		Swal.fire(
		  'Failed',
		  'Invalid staking amount',
		  'error'
		);
		return;
	}
	
	if(stake_amount>web3.utils.fromWei(ten_balance)*1){
		console.log(stake_amount, web3.utils.fromWei(ten_balance)*1);
		Swal.fire(
		  'Failed',
		  'TEN balance not enough',
		  'error'
		);
		return;
	}
	
	var allowance = await tenCont.methods.allowance(account, ENV.genesisMiningAddress).call();
	
	
	if(web3.utils.fromWei(allowance)*1<stake_amount){ //allowance not enough, ask to approve
		
	
		$('.go-stake').append(' <span class="mdi mdi-loading mdi-spin"></span>').attr('onclick', '');
		var uintmax = "115792089237316195423570985008687907853269984665640564039457584007913129639935";
		await tenCont.methods.approve(ENV.genesisMiningAddress, uintmax).send({from: account, gas: gasLimitApprove}, function(err, result){
			$('.go-stake .mdi-loading').remove();
			if (err) {
				$.magnificPopup.close();
				Swal.fire(
				  'Failed',
				  err.message,
				  'error'
				)
			} else {
				go_stake();
			}
		});
	}
	
	else{
		go_stake();
	}
}

var go_stake = async function(){
	
	if(!account){
		Swal.fire(
		  'Error',
		  'Connect MetaMask to continue.',
		  'error'
		)
		return;
	}
	
	var mvtCont =  new web3.eth.Contract(erc20Abi, ENV.mvtAddress);
	var tenCont =  new web3.eth.Contract(erc20Abi, ENV.cTokens.ten.underlyingAddress);
	var genesisCont =  new web3.eth.Contract(genesisMiningAbi, ENV.genesisMiningAddress);
	
	var stake_amount = $('#stake_amount').val();
	var stake_raw_amount = web3.utils.toWei(stake_amount);
	
	$('.go-stake').append(' <span class="mdi mdi-loading mdi-spin"></span>').attr('onclick', '');
	await genesisCont.methods.stake(stake_raw_amount).send({from: account, gas: gasLimitStake}, function(err, result){
		$('.go-stake .mdi-loading').remove();
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
			  result+' <a href="'+ENV.etherscan+'tx/'+result+'" target="_blank"><span class="mdi mdi-open-in-new"></span></a>',
			  'success'
			);
		}
	});
}

var go_unstake = async function(){
	
	if(!account){
		Swal.fire(
		  'Error',
		  'Connect MetaMask to continue.',
		  'error'
		)
		return;
	}
	
	var mvtCont =  new web3.eth.Contract(erc20Abi, ENV.mvtAddress);
	var tenCont =  new web3.eth.Contract(erc20Abi, ENV.cTokens.ten.underlyingAddress);
	var genesisCont =  new web3.eth.Contract(genesisMiningAbi, ENV.genesisMiningAddress);
	
	var unstake_amount = $('#unstake_amount').val();
	var unstake_raw_amount = web3.utils.toWei(unstake_amount);
	
	$('.go-unstake').append(' <span class="mdi mdi-loading mdi-spin"></span>').attr('onclick', '');
	await genesisCont.methods.unstake(unstake_raw_amount).send({from: account}, function(err, result){
		$('.go-unstake .mdi-loading').remove();
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
			  result+' <a href="'+ENV.etherscan+'tx/'+result+'" target="_blank"><span class="mdi mdi-open-in-new"></span></a>',
			  'success'
			);
		}
	});
}

var go_claim = async function(){
	
	if(!account){
		Swal.fire(
		  'Error',
		  'Connect MetaMask to continue.',
		  'error'
		)
		return;
	}
	
	var mvtCont =  new web3.eth.Contract(erc20Abi, ENV.mvtAddress);
	var tenCont =  new web3.eth.Contract(erc20Abi, ENV.cTokens.ten.underlyingAddress);
	var genesisCont =  new web3.eth.Contract(genesisMiningAbi, ENV.genesisMiningAddress);
	
	$('.go-claim').append(' <span class="mdi mdi-loading mdi-spin"></span>').attr('onclick', '');
	await genesisCont.methods.claimMvt().send({from: account}, function(err, result){
		$('.go-claim .mdi-loading').remove();
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
			  result+' <a href="'+ENV.etherscan+'tx/'+result+'" target="_blank"><span class="mdi mdi-open-in-new"></span></a>',
			  'success'
			);
		}
	});
}


var addMvtToMetamask = async function(){
	
	if(!account){
		Swal.fire(
		  'Error',
		  'Connect MetaMask to continue.',
		  'error'
		)
		return;
	}

	await ethereum.request({
	method: 'wallet_watchAsset',
	params: {
	  type: 'ERC20', // Initially only supports ERC20, but eventually more!
	  options: {
		address: ENV.mvtAddress, // The address that the token is at.
		symbol: 'MVT', // A ticker symbol or shorthand, up to 5 chars.
		decimals: 18, // The number of decimals in the token
		image: 'http://movement.finance/assets/images/new-logo/Logo-Movement-128x128px.png', // A string url of the token logo
	  },
	},
	});
}


var addTenToMetamask = async function(){
	
	if(!account){
		Swal.fire(
		  'Error',
		  'Connect MetaMask to continue.',
		  'error'
		)
		return;
	}

	await ethereum.request({
	method: 'wallet_watchAsset',
	params: {
	  type: 'ERC20', // Initially only supports ERC20, but eventually more!
	  options: {
		address: ENV.cTokens.ten.underlyingAddress, // The address that the token is at.
		symbol: 'TEN', // A ticker symbol or shorthand, up to 5 chars.
		decimals: 18, // The number of decimals in the token
		image: 'http://movement.finance/assets/images/tokens/ten_32.png', // A string url of the token logo
	  },
	},
	});
}

var getTenMvtPrices = async function(){
	let data = await fetch('https://api.thegraph.com/subgraphs/name/uniswap/uniswap-v2', {
	  method: 'POST',
	  headers: {
		'Content-Type': 'application/json',
		'Accept': 'application/json',
	  },
	  body: JSON.stringify({query: "{ \
		  tokens(where: {id_in: [\"0x3d46454212c61ecb7b31248047fa033120b88668\", \"0xdd16ec0f66e54d453e6756713e533355989040e4\"]}) {\
			id derivedETH symbol\
			}\
		  bundle(id: \"1\"){ ethPrice }	  }"})
	})
	  .then(r => r.json())
	  .then(data => {return data;});
	  
	  var ethPrice = data.data.bundle.ethPrice;
	  var mvtPrice = data.data.tokens[0].derivedETH * ethPrice;
	  var tenPrice = data.data.tokens[1].derivedETH * ethPrice;
	  
	  return {MVT: mvtPrice, TEN: tenPrice};
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