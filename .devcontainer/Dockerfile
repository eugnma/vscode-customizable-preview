FROM node:lts-stretch

# Set the default shell to bash rather than sh
ENV SHELL /bin/bash

# Use a non-root user
RUN groupadd default && useradd -m -g default default
ENV HOME=/home/default
USER default
