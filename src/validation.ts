export function validatePaths(sockets, paths) {
    // Check that we have same amount of paths and sockets
    const equalAmount = Object.keys(paths).length === sockets.length
    // Check that we have a path for each socket
    const allSocketsCovered =
        sockets.filter(
            socket => Object.keys(paths).indexOf(socket) < 0,
        ).length === 0
    // If either is false we throw error
    if (!equalAmount || !allSocketsCovered)
        throw new Error(`Paths and sockets don't match.`)
}
