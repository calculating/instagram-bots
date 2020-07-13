console.log("go");
var unfollow;
var confirm;
var unfollowed;
function unfollow() {
    console.log('eee');
    if (document.getElementsByClassName("sqdOP  L3NKy    _8A5w5    ").length > 1) {
        console.log('unfollowing');
        unfollow = document.querySelector("._1XyCr").querySelector(".sqdOP,  .L3NKy,   ._8A5w5    ");
        unfollow.style.backgroundColor = "red";
        unfollow.click();

        confirm = document.querySelector(".aOOlW, .-Cab_   ");
        confirm.style.backgroundColor = "orange";
        confirm.click();

        unfollowed = document.querySelector("._1XyCr").querySelector(".Igw0E, .rBNOH, .eGOV_, .ybXk5, ._4EzTm, .XfCBB, .HVWg4");
        unfollowed.parentNode.removeChild(unfollowed);
    }
}
//window.open('https://www.instagram.com/zacksjerryrig/', '_self');
window.open('http://example.com/', '_blank', 'width = 5, height = 5, left = 100000, top = 100000'); 
var myVar = setInterval(unfollow, 5000);