console.log("go");
function followAll() {
var follow
console.log(follow)
	follow = document.getElementsByClassName("sqdOP  L3NKy    _8A5w5    ");
  if (follow.length > 1) {
    for (var i = 2, e = follow.length; i < e; i++) {
  		console.log(follow[i])
  		follow[i].click();
  		for (n=0; n<10; n++) {
  			console.log(n);
  		}
  		var followconfirm = document.getElementsByClassName("aOOlW -Cab_   ");
  		followconfirm[0].click();
	}
  } else {
    setTimeout(followAll, 500);
  }
}
followAll();