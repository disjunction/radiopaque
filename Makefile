uglify:
	echo "Radiopaque = (function(){var module = {};\n" `node_modules/uglifyjs/bin/uglifyjs src/radiopaque.js` "\nreturn module.exports;})();" > dist/radiopaque.global.js
