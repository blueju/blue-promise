// 使用 ES6 Class 的方式创建构造函数 BluePromise
class BluePromise {
  /**
   * https://developer.mozilla.org/zh-CN/docs/Web/JavaScript/Reference/Classes/static
   * 以静态变量定义三种状态
   */
  static Pending = "pending";
  static Fulfilled = "fulfilled";
  static Rejected = "rejected";
  // 构造函数，实例化时执行
  constructor(executor) {
    // 初始状态为 pending
    this.status = BluePromise.Pending;
    // 存储 resolve(value) 或 reject(reason) 时传入的参数 value 和 reason，执行 then 时取出
    this.value = null;
    /**
     * 思路（应用场景）：
     * 1. 碰见 Promise((resolve,reject)=>{...}) ，执行 ...
     * 2. 执行下来，没有立即执行到 resolve() 或 reject() ，而是要等多几秒 （因为被 setTimeout 包裹住了）
     * 3. 接下来执行到 then ，因为上文没有立即执行 resolve() 或 reject() ，状态仍处于 pending ,
     *    因此不能现在就将 onFulfilled, onRejected 放入 setTimeout 几秒后执行，必须等 resolve() 或 reject() 有反应了/有执行了/状态有发生改变了，
     *    才能开始将 onFulfilled, onRejected 放入 setTimeout 几秒后执行，那现在怎么办呢？
     *    正常情况是先执行了 resolve/reject 后才执行 then ，但现在这种情况是先执行 then 后才执行 resolve/reject ，
     *    所以没办法，那就先用个数组，将 onFulfilled, onRejected 先存着，等到 resolve/reject 执行时，我再取出来 放入到 setTimeout
     */
    this.callbacks = [];
    try {
      // 执行执行器函数，即 Promise((resolve,reject)=>{}) 中的 (resolve,reject)=>{}
      executor(this.resolve.bind(this), this.reject.bind(this));
    } catch (error) {
      // 如果报错，则改变状态为 rejected
      this.reject(error);
    }
  }
  resolve(value) {
    // 改变状态的前提是当前状态为 pending 状态
    if (this.status == BluePromise.Pending) {
      // 改变状态
      this.status = BluePromise.Fulfilled;
      // 将传入的值保存起来，该值也即是 then((res)=>{}) 中的 res
      this.value = value;
      // 为啥详见 this.callbacks 思路（应用场景）
      setTimeout(() => {
        this.callbacks.map((callback) => {
          callback.onFulfilled(value);
        });
      });
    }
  }
  reject(reason) {
    // 改变状态的前提是当前状态为 pending 状态
    if (this.status == BluePromise.Pending) {
      // 改变状态
      this.status = BluePromise.Rejected;
      // 将传入的值保存起来，该值也即是 catch((err)=>{}) 中的 err
      this.value = reason;
      // 为啥详见 this.callbacks 思路（应用场景）
      setTimeout(() => {
        this.callbacks.map((callback) => {
          callback.onRejected(reason);
        });
      });
    }
  }
  /**
   * https://developer.mozilla.org/zh-CN/docs/Web/JavaScript/Reference/Global_Objects/Promise/then#参数
   * @param {*} onFulfilled 当 Promise 变成接受状态（fulfilled）时调用的函数
   * @param {*} onRejected  当 Promise 变成拒绝状态（rejected）时调用的函数。
   */
  then(onFulfilled, onRejected) {
    //
    if (typeof onFulfilled != "function") {
      onFulfilled = () => this.value;
    }
    if (typeof onRejected != "function") {
      onRejected = () => this.value;
    }
    let promise = new BluePromise((resolve, reject) => {
      /**
       * 对应的是这种情况：
       * new Promise((resolve,reject)=>{
       *   console.log("xxx")
       *   setTimeout(()=>{
       *     resolve(value)
       *   })
       * }).then((value)=>{},(reason)=>{})
       */
      if (this.status == BluePromise.Pending) {
        this.callbacks.push({
          onFulfilled: (value) => {
            try {
              // 可能是一个普通的基本类型/引用类型的值，也可能是一个Promise
              let returnValue = onFulfilled(this.value);
              if (returnValue instanceof BluePromise) {
                // 如果接到的返回值是一个 Promise，则执行这个Promise的then方法
                returnValue.then(resolve, reject);
              } else {
                // 如果 new Promise(()=>{...}) 中的 ... 只是返回一个值的情况，直接 resolve(value)
                resolve(returnValue);
              }
            } catch (error) {
              reject(error);
            }
          },
          onRejected: (value) => {
            try {
              let returnValue = onRejected(this.value);
              if (returnValue === BluePromise) {
                returnValue.then(resolve, reject);
              } else {
                resolve(returnValue);
              }
            } catch (error) {
              reject(err);
            }
          },
        });
      }
      /**
       * 对应的是这种情况：手动进行了resolve/reject的
       * new Promise((resolve,reject)=>{
       *   console.log("xxx")
       *   resolve(value)
       * }).then((value)=>{},(reason)=>{})
       */
      if (this.status == BluePromise.Fulfilled) {
        setTimeout(() => {
          try {
            // 可能是一个普通的基本类型/引用类型的值，也可能是一个Promise
            let returnValue = onFulfilled(this.value);
            if (returnValue instanceof BluePromise) {
              // 如果接到的返回值是一个 Promise，则执行这个Promise的then方法
              returnValue.then(resolve, reject);
            } else {
              // 如果 new Promise(()=>{...}) 中的 ... 只是返回一个值的情况，直接 resolve(value)
              resolve(returnValue);
            }
          } catch (error) {
            reject(error);
          }
        });
      }
      if (this.status == BluePromise.Rejected) {
        setTimeout(() => {
          try {
            let returnValue = onRejected(this.value);
            if (returnValue === BluePromise) {
              returnValue.then(resolve, reject);
            } else {
              resolve(returnValue);
            }
          } catch (error) {
            reject(err);
          }
        });
      }
    });
    return promise;
  }
  /**
   * 静态方法
   * 仅供 Promise 自身调用，如：
   * Promise.resolve
   * Promise.reject
   * Promise.all
   * Promise.race
   */
  // https://developer.mozilla.org/zh-CN/docs/Web/JavaScript/Reference/Global_Objects/Promise/resolve
  static resolve(value) {
    return new BluePromise((resolve, reject) => {
      if (value instanceof BluePromise) {
        /**
         * Why???
         * https://developer.mozilla.org/zh-CN/docs/Web/JavaScript/Reference/Global_Objects/Promise/resolve#resolve另一个promise
         * 参照以上链接中的示例：如果不进行 value.then() 那么下一个 Promise 的 then((value)=>{}) 中的 value ， 就是一个 Promise ，这或许不太正常吧
         */
        value.then(resolve, reject);
      } else {
        resolve(value);
      }
    });
  }
  // https://developer.mozilla.org/zh-CN/docs/Web/JavaScript/Reference/Global_Objects/Promise/reject
  static reject(value) {
    return new BluePromise((resolve, reject) => {
      reject(value);
    });
  }
  /**
   * 先需要了解 Promise.all 的用法
   * https://developer.mozilla.org/zh-CN/docs/Web/JavaScript/Reference/Global_Objects/Promise/all
   * @param {*} promiseArray Promise 数组
   */
  static all(promiseArray) {
    /**
     * 存储每个 Promise（除了最后一个）传递给下一个 Promise 的值，即 resolve(value) 中的 value
     * 遍历到最后一个 Promise 时，才一并 resolve(valueList) 传递下去
     */
    const valueList = [];
    return new BluePromise((resolve, reject) => {
      promiseArray.forEach((promise) => {
        promise.then(
          // onFulfilled
          (value) => {
            valueList.push(value);
            if (valueList.length == promiseArray.length) {
              resolve(valueList);
            }
          },
          // onRejected
          (reason) => {
            reject(reason);
          }
        );
      });
    });
  }
  /**
   * 先需要了解 Promise.race 的用法
   * https://developer.mozilla.org/zh-CN/docs/Web/JavaScript/Reference/Global_Objects/Promise/race
   * @param {*} promiseArray Promise 数组
   */
  static race(promiseArray) {
    return new BluePromise((resolve, reject) => {
      promiseArray.forEach((promise) => {
        promise.then(
          // onFulfilled
          (value) => {
            resolve(value);
          },
          // onRejected
          (reason) => {
            reject(reason);
          }
        );
      });
    });
  }
}

// 为了测试方便而导出
module.exports = BluePromise;
