(function () {
    let ctx = {
        container: null
    };
    window.appA = {
        bootstrap:function () {
            return Promise.resolve().then(() => {
                console.log('bootstrap');
                ctx.container = document.querySelector('#app')
            })
        },
        mount: function () {
            return Promise.resolve().then(() => {
                console.log('mount');
                ctx.container.innerHTML = 'hello world appA'
            })
        },
        unmount: function () {
            return Promise.resolve().then(() => {
                console.log('unmount');
                ctx.container.innerHTML = ''
            })
        },
    }
})();
