
var infura_key = 'cce8dccbfb524ca691cd109d9e214d53';
var infura_mainnet_url = 'https://mainnet.infura.io/v3/'+infura_key;
var infura_goerli_url = 'https://goerli.infura.io/v3/'+infura_key;



if(ethereum!== 'undefined'&& ethereum.chainId=='0x5'){
	var web3 = new Web3(new Web3.providers.HttpProvider(infura_goerli_url));
}
else{
	var web3 = new Web3(new Web3.providers.HttpProvider(infura_mainnet_url));
}

//temporary always goerli
var web3 = new Web3(new Web3.providers.HttpProvider(infura_goerli_url));

var account;

var connectMetamask = async function(){
	
	
	if (typeof window.ethereum == 'undefined' || !ethereum.isMetaMask) {
		
		if (/Mobi|Android/i.test(navigator.userAgent)) {
			Swal.fire(
			  '',
			  'From your phone, open this website from MetaMask application.<br /><br />To get Metamask: <a href="https://metamask.io/download.html" target="_blank">https://metamask.io/download.html</a>.',
			  'info'
			)
			return;
		}
		
		Swal.fire(
		  'Error',
		  'You need a MetaMask plugin in your browser.<br /><br />To get Metamask: <a href="https://metamask.io/download.html" target="_blank">https://metamask.io/download.html</a>.',
		  'error'
		)
		return;
	}
	
	var accounts = await ethereum.request({ method: 'eth_requestAccounts' });
	account = accounts[0];
	
	
	const eth_chainId = await ethereum.request({ method: 'eth_chainId' });
	
	//force testnet
	if(eth_chainId=='0x1'||eth_chainId=='0x01'){ //mainnet
		Swal.fire(
		  'Error',
		  'Saving and Lending app is under development and currently only available in Goerli Testnet. Change your Metamask network to Goerli to use this app.',
		  'error'
		);
		return;
	}
	
	web3 = new Web3(ethereum);
	
	if(!change_environment(eth_chainId)){
		console.log('eth_chainId', eth_chainId);
		return;
	}
	
	$('#btn_connect_metamask').html('Connected<span>: '+account.substring(0, 6)+'..'+account.substring(account.length-4, account.length)+'</span>');
	
}

ethereum.on('accountsChanged', async (accounts) => {
	
	eth_chainId = await ethereum.request({ method: 'eth_chainId' });
	
	//force testnet
	if(eth_chainId=='0x1'||eth_chainId=='0x01'){ //mainnet
		//~ Swal.fire(
		  //~ 'Error',
		  //~ 'Saving and Lending app is under development and currently only available in Goerli Testnet. Change your Metamask network to Goerli to use this app.',
		  //~ 'error'
		//~ );
		return;
	}
	
	
	account = accounts[0];
	
	web3 = new Web3(ethereum);
	
	$('#btn_connect_metamask').html('Connected<span>: '+account.substring(0, 6)+'..'+account.substring(account.length-4, account.length)+'</span>');
	
	change_environment(eth_chainId);
});

ethereum.on('chainChanged', async (chainId) => {
	
	//force testnet
	if(chainChanged=='0x1'||chainChanged=='0x01'){ //mainnet
		//~ Swal.fire(
		  //~ 'Error',
		  //~ 'Saving and Lending app is under development and currently only available in Goerli Testnet. Change your Metamask network to Goerli to use this app.',
		  //~ 'error'
		//~ );
		return;
	}
	
	change_environment(chainId);
});

$(function(){
	if(typeof ethereum!== 'undefined'){
		//connectMetamask();
	}
});