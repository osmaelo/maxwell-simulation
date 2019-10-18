import React, { useRef, useCallback, useEffect } from 'react'
import { GPU } from "gpu.js"
import { FDTDSimulator, addScalarField3DValue } from "./simulator"

const canvasSize = [window.innerWidth, window.innerHeight]

const dt = 0.01
const gridSizeX = 400
const gridSize: [number, number, number] = [gridSizeX, Math.ceil(gridSizeX / canvasSize[0] * canvasSize[1]), 1]
const cellSize = 0.03

const simulator = new FDTDSimulator(gridSize, cellSize)

const makeRenderSimulatorCanvas = (g: GPU) => {
    function getAt(field: number[], shapeX: number, shapeY: number, shapeZ: number, x: number, y: number, z: number) {
        if (x < 0 || x >= shapeX || y < 0 || y >= shapeY || z < 0 || z >= shapeZ) {
            return 0
        }

        return field[x + y * shapeX + z * shapeX * shapeZ]
    }

    return g.createKernel(function (electricFieldX: number[], electricFieldY: number[], electricFieldZ: number[], magneticFieldX: number[], magneticFieldY: number[], magneticFieldZ: number[]) {
        const gx = this.constants.gridSizeX as number
        const gy = this.constants.gridSizeY as number
        const gz = this.constants.gridSizeZ as number

        const ox = this.output.x as number
        const oy = this.output.y as number

        const x = gx * this.thread.x! / ox
        const y = gy * (1 - this.thread.y! / oy)
        const xa = Math.floor(x)
        const ya = Math.floor(y)
        const xb = xa + 1
        const yb = ya + 1

        const alphaX = xb === xa ? 0 : (x - xa) / (xb - xa)
        const alphaY = yb === ya ? 0 : (y - ya) / (yb - ya)

        const z = Math.floor(gz / 2)

        const eAA = getAt(electricFieldX, gx, gy, gz, xa, ya, z) * getAt(electricFieldX, gx, gy, gz, xa, ya, z) + getAt(electricFieldY, gx, gy, gz, xa, ya, z) * getAt(electricFieldY, gx, gy, gz, xa, ya, z) + getAt(electricFieldZ, gx, gy, gz, xa, ya, z) * getAt(electricFieldZ, gx, gy, gz, xa, ya, z)
        const eAB = getAt(electricFieldX, gx, gy, gz, xa, yb, z) * getAt(electricFieldX, gx, gy, gz, xa, yb, z) + getAt(electricFieldY, gx, gy, gz, xa, yb, z) * getAt(electricFieldY, gx, gy, gz, xa, yb, z) + getAt(electricFieldZ, gx, gy, gz, xa, yb, z) * getAt(electricFieldZ, gx, gy, gz, xa, yb, z)
        const eBA = getAt(electricFieldX, gx, gy, gz, xb, ya, z) * getAt(electricFieldX, gx, gy, gz, xb, ya, z) + getAt(electricFieldY, gx, gy, gz, xb, ya, z) * getAt(electricFieldY, gx, gy, gz, xb, ya, z) + getAt(electricFieldZ, gx, gy, gz, xb, ya, z) * getAt(electricFieldZ, gx, gy, gz, xb, ya, z)
        const eBB = getAt(electricFieldX, gx, gy, gz, xb, yb, z) * getAt(electricFieldX, gx, gy, gz, xb, yb, z) + getAt(electricFieldY, gx, gy, gz, xb, yb, z) * getAt(electricFieldY, gx, gy, gz, xb, yb, z) + getAt(electricFieldZ, gx, gy, gz, xb, yb, z) * getAt(electricFieldZ, gx, gy, gz, xb, yb, z)

        // Magnetic field is offset from electric field, so get value at +0.5 by interpolating 0 and 1
        const magXAA = (getAt(magneticFieldX, gx, gy, gz, xa, ya, z) + getAt(magneticFieldX, gx, gy, gz, xa + 1, ya + 1, z)) / 2
        const magYAA = (getAt(magneticFieldY, gx, gy, gz, xa, ya, z) + getAt(magneticFieldY, gx, gy, gz, xa + 1, ya + 1, z)) / 2
        const magZAA = (getAt(magneticFieldZ, gx, gy, gz, xa, ya, z) + getAt(magneticFieldZ, gx, gy, gz, xa + 1, ya + 1, z)) / 2
        const magXAB = (getAt(magneticFieldX, gx, gy, gz, xa, yb, z) + getAt(magneticFieldX, gx, gy, gz, xa + 1, yb + 1, z)) / 2
        const magYAB = (getAt(magneticFieldY, gx, gy, gz, xa, yb, z) + getAt(magneticFieldY, gx, gy, gz, xa + 1, yb + 1, z)) / 2
        const magZAB = (getAt(magneticFieldZ, gx, gy, gz, xa, yb, z) + getAt(magneticFieldZ, gx, gy, gz, xa + 1, yb + 1, z)) / 2
        const magXBA = (getAt(magneticFieldX, gx, gy, gz, xb, ya, z) + getAt(magneticFieldX, gx, gy, gz, xb + 1, ya + 1, z)) / 2
        const magYBA = (getAt(magneticFieldY, gx, gy, gz, xb, ya, z) + getAt(magneticFieldY, gx, gy, gz, xb + 1, ya + 1, z)) / 2
        const magZBA = (getAt(magneticFieldZ, gx, gy, gz, xb, ya, z) + getAt(magneticFieldZ, gx, gy, gz, xb + 1, ya + 1, z)) / 2
        const magXBB = (getAt(magneticFieldX, gx, gy, gz, xb, yb, z) + getAt(magneticFieldX, gx, gy, gz, xb + 1, yb + 1, z)) / 2
        const magYBB = (getAt(magneticFieldY, gx, gy, gz, xb, yb, z) + getAt(magneticFieldY, gx, gy, gz, xb + 1, yb + 1, z)) / 2
        const magZBB = (getAt(magneticFieldZ, gx, gy, gz, xb, yb, z) + getAt(magneticFieldZ, gx, gy, gz, xb + 1, yb + 1, z)) / 2

        const mAA = magXAA * magXAA + magYAA * magYAA + magZAA * magZAA
        const mAB = magXAB * magXAB + magYAB * magYAB + magZAB * magZAB
        const mBA = magXBA * magXBA + magYBA * magYBA + magZBA * magZBA
        const mBB = magXBB * magXBB + magYBB * magYBB + magZBB * magZBB

        const scale = 50

        const eMixTop = alphaX * eBA + (1 - alphaX) * eAA
        const eMixBottom = alphaX * eBB + (1 - alphaX) * eAB
        const eMix = Math.max(0, Math.min(scale, alphaY * eMixBottom + (1 - alphaY) * eMixTop))

        const mMixTop = alphaX * mBA + (1 - alphaX) * mAA
        const mMixBottom = alphaX * mBB + (1 - alphaX) * mAB

        const mMix = Math.max(0, Math.min(scale, alphaY * mMixBottom + (1 - alphaY) * mMixTop))

        this.color(eMix / scale, 0, mMix / scale)
        //this.color(eAA, 0, 0)
        //this.color(alphaX, alphaY, 0)
        //this.color(getAt(electricFieldZ, gx, gy, gz, xa, ya, z) * getAt(electricFieldZ, gx, gy, gz, xa, ya, z), 0, 0)
    }, {
        output: [canvasSize[0], canvasSize[1]],
        constants: { gridSizeX: gridSize[0], gridSizeY: gridSize[1], gridSizeZ: gridSize[2] },
        graphical: true
    }).setFunctions([getAt])
}

function clamp(min: number, max: number, value: number) {
    return Math.max(min, Math.min(max, value))
}

let renderSim: any = null
let signalStrength = 0
let signalPosition = [0, 0]
let mouseDownPos: [number, number] | null = null

export default function () {
    const drawCanvasRef = useRef<HTMLCanvasElement>(null)

    const startLoop = useCallback(() => {
        let stop = false

        const loop = (async () => {
            let simReady = false
            const resolveSimPromise = (resolve: any) => setTimeout(() => { simReady = true; resolve() }, 1000 * dt)
            const resolveDrawPromise = (resolve: any) => requestAnimationFrame(resolve)

            let simPromise = new Promise(resolveSimPromise)
            let drawPromise = new Promise(resolveDrawPromise)

            while (!stop) {
                await Promise.race([simPromise, drawPromise])

                const simData = simulator.getData()

                if (simReady || simulator.getData().time <= 0) {
                    if (mouseDownPos !== null) {
                        signalPosition = mouseDownPos
                        signalStrength = Math.min(10000, signalStrength + dt * 10000)
                    }

                    signalStrength *= Math.pow(0.1, dt)

                    if (signalStrength > 1 && drawCanvasRef.current) {
                        const px = clamp(0, simData.electricFieldX.shape[0] - 1, Math.floor(simData.electricFieldX.shape[0] * signalPosition[0] / drawCanvasRef.current.width))
                        const py = clamp(0, simData.electricFieldX.shape[1] - 1, Math.floor(simData.electricFieldX.shape[1] * signalPosition[1] / drawCanvasRef.current.height))

                        for (let z = 0; z < simData.electricFieldX.shape[2]; z++) {
                            //addScalarField3DValue(simData.electricFieldX, px, py, z, sig[0] * dt / 2)
                            //addScalarField3DValue(simData.electricFieldY, px, py, z, sig[1] * dt / 2)
                            addScalarField3DValue(simData.electricFieldZ, px, py, z, Math.sin(2 * 2 * Math.PI * simData.time) * signalStrength * dt)
                        }
                    }

                    simulator.stepMagnetic(dt)
                    simulator.stepElectric(dt)

                    simPromise = new Promise(resolveSimPromise)
                } else {
                    if (renderSim === null && drawCanvasRef.current !== null) {
                        renderSim = makeRenderSimulatorCanvas(new GPU({ mode: "webgl2", canvas: drawCanvasRef.current }))
                    }

                    if (renderSim !== null) {
                        renderSim(simData.electricFieldX.values, simData.electricFieldY.values, simData.electricFieldZ.values,
                            simData.magneticFieldX.values, simData.magneticFieldY.values, simData.magneticFieldZ.values)
                    }

                    drawPromise = new Promise(resolveDrawPromise)
                }

                simReady = false
                await Promise.race([simPromise, drawPromise])
            }
        })

        loop()

        return () => { stop = true }
    }, [])

    useEffect(startLoop, [startLoop])

    return (
        <canvas width={canvasSize[0]} height={canvasSize[1]} ref={drawCanvasRef}
            onMouseDown={e => mouseDownPos = [e.clientX, e.clientY]}
            onMouseMove={e => { if (mouseDownPos !== null) mouseDownPos = [e.clientX, e.clientY] }}
            onMouseUp={_ => mouseDownPos = null} />
    )
}
