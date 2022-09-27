export class AlertConfig {
    isOpen: boolean
    uuid: string // alert config for server that identify by uuid
    fromHost: string
    fromPort: number
    fromSecure: boolean
    fromEmail: string
    fromPassword: string
    toEmail: string

    cpuCheck: boolean
    memCheck: boolean
    diskCheck: boolean
    upCheck: boolean

    cpuAlertValue: number
    memAlertValue: number
    diskAlertValue: number
    cpuAlertForValue: number
    memAlertForValue: number
    diskAlertForValue: number
    upAlertForValue: number

    mailInterval: number
}

