uglify:
	echo "Radiopaque = (function(){var module = {};\n" `uglifyjs src/radiopaque.js` "\nreturn module.exports;})();" > dist/radiopaque.global.js
