import test from 'ava'
import { CallbackTestContext, Context } from 'ava'
import { configure } from '../src/index'
import { AppError } from '../src/debug'

export const config = {
    debugMessages: false,
    softErrors: false,
    globalObject: false,
    runtimeValidations: true,
}

export const configWithError = (
    t: CallbackTestContext & Context<any>,
    sourceType,
    sourceName,
    message?,
) =>
    Object.assign(
        {
            onError: (error) => {
                if (
                    error.sourceType === sourceType &&
                    error.sourceName.includes(sourceName) &&
                    (!message || error.message.includes(message))
                ) {
                    t.pass()
                } else {
                    t.fail(`
Expected to get error
Type:             ${sourceType}
Name includes:    ${sourceName}
Message includes: ${message || ''}

But got
Type:    ${error.sourceType}
Name:    ${error.sourceName}
Message: ${error.message}
`)
                }
                t.end()
            },
        },
        config,
    )
