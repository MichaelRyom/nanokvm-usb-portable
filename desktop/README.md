# NanoKVM-USB Desktop

This is the NanoKVM-USB desktop version project.


## Development

Linux build tool chain:

```shell
sudo apt update
sudo apt install -y build-essential python3 libudev-dev
echo "python=/usr/bin/python3.10" >> ~/.npmrc # This should match you pyton version.
```

```shell
cd desktop
pnpm install
pnpm start
```

## Compile

```shell
# For Windows
pnpm build:win

# For MacOS
pnpm build:mac

# For Linux
pnpm build:linux
```

# For Linux run and install
```shell
dpkg -i dist/nanokvm-usb_1.0.0_amd64.deb
sudo chown root:root /opt/NanoKVM-USB/chrome-sandbox
sudo chmod 4755 /opt/NanoKVM-USB/chrome-sandbox
```
