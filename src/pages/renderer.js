
// import './app';

console.log("-----------", window.myAPI);

(async function () {
    const text = await window.conf.get();
    console.log("0---------------", text);
}());
