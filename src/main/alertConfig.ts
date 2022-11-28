export class AlertConfig {
    isOpen: boolean
    uuid: string // alert config for server that identify by uuid
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

