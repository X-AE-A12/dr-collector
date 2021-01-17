const containsNull = (arr) => {
    try {
        if (!arr) throw new Error("Params are missing")
        return arr.some(el => el == null)
    } catch (err) {
        throw err
    }
}

module.exports = {
    containsNull
}
