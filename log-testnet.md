```
$ npx blueprint run --testnet --mnemonic deployLiteClient
Using file: deployLiteClient
Connected to wallet at address: EQDhGzp_NUDOCqQOZlhUHdzgCShXIEqIueqrvLs-p_4xdWZk
Loading last mc block
Deploying contract for globalId=-217 seqNo=1020971 validators=1
Deploying from EQDhGzp_NUDOCqQOZlhUHdzgCShXIEqIueqrvLs-p_4xdWZk to EQDpiUXlRqHFXOt94EZhTgW1fVTitjzomBeGwkLuFnRhvTdI
Sent transaction
Contract deployed at address EQDpiUXlRqHFXOt94EZhTgW1fVTitjzomBeGwkLuFnRhvTdI
You can view it at https://testnet.tonscan.org/address/EQDpiUXlRqHFXOt94EZhTgW1fVTitjzomBeGwkLuFnRhvTdI

https://testnet.tonscan.org/tx/7a2aa391a2f10c6c758dbe866d344ab6a8cec418ba35c4c26997535a3cc4d899


$ npx blueprint run --testnet --mnemonic liteClientCheckBlock EQDpiUXlRqHFXOt94EZhTgW1fVTitjzomBeGwkLuFnRhvTdI 1020972
Using file: liteClientCheckBlock
Connected to wallet at address: EQDhGzp_NUDOCqQOZlhUHdzgCShXIEqIueqrvLs-p_4xdWZk
Sent transaction

https://testnet.tonscan.org/tx/dc531c3ceb730606d53040ee5f3df9db4892a35bf7b4eb4a0823d9848f841d85


$ npx blueprint run --testnet --mnemonic liteClientCheckBlock EQDpiUXlRqHFXOt94EZhTgW1fVTitjzomBeGwkLuFnRhvTdI 1020970
Using file: liteClientCheckBlock
Connected to wallet at address: EQDhGzp_NUDOCqQOZlhUHdzgCShXIEqIueqrvLs-p_4xdWZk
Sent transaction

https://testnet.tonscan.org/tx/4ad858304654f82080a634163738436294473ced4c937182e8455db2f5b3372c


$ npx blueprint run --testnet --mnemonic deployTransactionChecker EQDpiUXlRqHFXOt94EZhTgW1fVTitjzomBeGwkLuFnRhvTdI
Using file: deployTransactionChecker
Connected to wallet at address: EQDhGzp_NUDOCqQOZlhUHdzgCShXIEqIueqrvLs-p_4xdWZk
Deploying from EQDhGzp_NUDOCqQOZlhUHdzgCShXIEqIueqrvLs-p_4xdWZk to EQBluhRJSh9r0z6NGi_PdGBPCE8M2aQxHprsM210ALMLPpkw
Sent transaction
Contract deployed at address EQBluhRJSh9r0z6NGi_PdGBPCE8M2aQxHprsM210ALMLPpkw
You can view it at https://testnet.tonscan.org/address/EQBluhRJSh9r0z6NGi_PdGBPCE8M2aQxHprsM210ALMLPpkw

https://testnet.tonscan.org/tx/b063422699cc3f56722ab061e8f00e51f51a608aea0ddee141201d5283ea629e


$ npx blueprint run --testnet --mnemonic transactionChecker EQBluhRJSh9r0z6NGi_PdGBPCE8M2aQxHprsM210ALMLPpkw 1020972
Using file: transactionChecker
Connected to wallet at address: EQDhGzp_NUDOCqQOZlhUHdzgCShXIEqIueqrvLs-p_4xdWZk
? Choose a transaction to check 5f41f0e7f56a33e2f228ef716636ad9fe0efecf86828c344526a65d4bb03d8f7: to=3333333333333333333333333333333333333333333333333333333333333333 lt=1020972000001
Sent transaction

https://testnet.tonscan.org/tx/2c1ff18bd0c5d46f475973b89959e325f0670f07419678f9a6042e0fac077626


$ npx blueprint run --testnet --mnemonic transactionChecker EQBluhRJSh9r0z6NGi_PdGBPCE8M2aQxHprsM210ALMLPpkw 1020970
Using file: transactionChecker
Connected to wallet at address: EQDhGzp_NUDOCqQOZlhUHdzgCShXIEqIueqrvLs-p_4xdWZk
? Choose a transaction to check 8daea9c491f119323d3603205f938d017f48a0fa9a71d5dedc3b97752bb7cf2a: to=3333333333333333333333333333333333333333333333333333333333333333 lt=1020970000001
Sent transaction

https://testnet.tonscan.org/tx/bd6e5e67a9d70e6bcc200358d552a705395beded21b95f6d060a90f9c853c050
```