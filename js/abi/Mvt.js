var Comp  = new Object();

Comp.name = 'Ethereum';
Comp.id = 'eth';
Comp.index = 'ethereum';
Comp.unit = 'ETH';
Comp.logo = './assets/libs/cryptocurrency-icons/svg/color/eth.svg';
Comp.cTokenDecimals = 8;
Comp.underlyingDecimals = 18;
Comp.address = '0x4ddc2d193948926d02f9b1fe9e1daa0718270ed5';
Comp.abi = 




Comp.cToken = new web3.eth.Contract(cBat.abi, cBat.address);