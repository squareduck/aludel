import test from 'ava'
import { configure } from '../src/index'

const testConfig = {
    debugMessages: false,
    softErrors: false,
    globalObject: false,
    runtimeValidations: true,
}

export const setup = () => {
    configure(testConfig)
}
