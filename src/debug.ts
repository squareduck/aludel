/*
 * Helper utilities (configuration, validation, reporting, etc)
 *
 * Difference between validation and checking:
 * Validations ensure correctness before the app runs. It throws.
 * Checks generate errors in App log at runtime.
 */

export type Partial<T> = { [P in keyof T]?: T[P] }

/*
 * Application configuration
 * 
 * debugMessages      : Print messages about noteworthy actions
 * softErrors         : Don't throw on validation errors
 * globalObject       : Add useful methods and data to window.Aludel
 * runtimeValidations : Enable runtime validations and checks
 * 
 */

export type AppConfig = {
    debugMessages: boolean
    globalObject: boolean
    runtimeValidations: boolean
    runtimeErrors: AppError[]
}

/*
 * Application error
 */

export type AppError = {
    sourceType: 'Route' | 'Template' | 'Component' | 'Action'
    sourceName: string
    message: string
}

export const applyConfig = (config: Partial<AppConfig>) => {
    const defaultConfig: AppConfig = {
        debugMessages: true,
        globalObject: true,
        runtimeValidations: true,
        runtimeErrors: [],
    }

    return Object.assign(defaultConfig, config)
}

/*
 * Set of debugging functions that only run when corresponding field in appConfig is
 * set to true.
 * 
 */
export const setGlobal = (appConfig: AppConfig, name: string, value: any) => {
    if (appConfig.globalObject) {
        if (!window['Aludel'])
            window['Aludel'] = {
                errors: [],
            }
        window['Aludel'][name] = value
    }
}

/*
 * Declaration errors occur before app is running.
 * They always throw. 
 *
 * Runtime errors are logged into console and recorded in runtimeErrors array
 * in application config.
 *
 * Logging just prints to console
 *
 */

export const errorToString = (error: AppError) => {
    return `ERROR: [${error.sourceType} ${error.sourceName}] - ${error.message}`
}

export const declarationError = (error: AppError) => {
    throw new Error(errorToString(error))
}

export const runtimeError = (appConfig, error: AppError) => {
    appConfig.runtimeErrors.push(error)
    console.error(errorToString(error))
}

export const log = (appConfig: AppConfig, ...args) => {
    if (appConfig.debugMessages) console.log(...args)
}

/*
 * Make sure sockets and paths match.
 */

export const validateComponentPaths = (name, sockets: string[], paths: any) => {
    // Check for any sockets with undefined paths
    sockets.forEach((socket) => {
        if (!paths[socket])
            declarationError({
                sourceType: 'Component',
                sourceName: name,
                message: `No path defined for socket ${socket}`,
            })
    })
    // If each socket has it's path, then any additional paths should define unknown
    // sockets. This is an error.
    if (Object.keys(paths).length > sockets.length)
        declarationError({
            sourceType: 'Component',
            sourceName: name,
            message: `Unknown sockets [${Object.keys(paths).filter(
                (k) => sockets.indexOf(k) < 0,
            )}]`,
        })
}

/*
 * Make sure that local model has only fields defined in sockets
 */
export const checkLocalModel = (
    appConfig: AppConfig,
    componentName: string,
    actionName: string,
    model: any,
    sockets: string[],
) => {
    if (!appConfig.runtimeValidations) return

    const modelKeys = Object.keys(model)

    const extra = modelKeys.reduce((acc, key) => {
        if (sockets.indexOf(key) < 0) acc.push(key)
        return acc
    }, [])

    const missing = sockets.reduce((acc, socket) => {
        if (modelKeys.indexOf(socket) < 0) acc.push(socket)
        return acc
    }, [])

    if (extra.length > 0 || missing.length > 0) {
        let problem = ''
        if (extra.length > 0) problem += ` extra fields: [${extra}]`
        if (missing.length > 0) problem += ` missing fields: [${missing}]`
        runtimeError(appConfig, {
            sourceType: 'Action',
            sourceName: `${componentName} : ${actionName}`,
            message: `Local model returned from action does not match component sockets. Expected fields [${sockets}], but got${problem}.`,
        })
    }
}
